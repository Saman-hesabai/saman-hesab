import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import '../App.css'

type Page = 'home' | 'debt' | 'payment' | 'customers' | 'today'
type TxType = 'debt' | 'payment'

type Tx = {
  id: string
  customer_name: string
  type: TxType
  amount: number
  description: string | null
  created_at: string
}

type CustomerBalance = {
  name: string
  debt: number
  payment: number
  balance: number
}

function getStoreId() {
  return localStorage.getItem('store_id') || ''
}

const money = (n: number) => n.toLocaleString('fa-IR') + ' تومان'

function App() {
  const [page, setPage] = useState<Page>('home')
  const [stats, setStats] = useState({ customers: 0, debt: 0, payment: 0, balance: 0 })
  const [selectedCustomer, setSelectedCustomer] = useState<string | null>(null)

  async function loadStats() {
    const { data } = await supabase.from('transactions').select('customer_name,type,amount').eq('store_id', getStoreId())
    const names = new Set<string>()
    let debt = 0
    let payment = 0

    ;(data || []).forEach((tx: any) => {
      names.add(tx.customer_name)
      if (tx.type === 'debt') debt += Number(tx.amount)
      if (tx.type === 'payment') payment += Number(tx.amount)
    })

    setStats({ customers: names.size, debt, payment, balance: debt - payment })
  }

  useEffect(() => {
    loadStats()
  }, [])

  function goHome() {
    setPage('home')
    setSelectedCustomer(null)
    loadStats()
  }

  return (
    <main className="app" dir="rtl">
      <VoiceAssistant setPage={setPage} loadStats={loadStats} />

      {page !== 'home' && <button className="back" onClick={goHome}>بازگشت</button>}

      {page === 'home' && (
        <>
          <header>
            <h1>سامان حساب</h1>
            <p>دفتر نسیه هوشمند فروشگاه</p>
          </header>

          <section className="stats">
            <div>👥 مشتری‌ها: <b>{stats.customers.toLocaleString('fa-IR')}</b></div>
            <div>💰 بدهی کل: <b>{money(stats.debt)}</b></div>
            <div>💵 پرداخت کل: <b>{money(stats.payment)}</b></div>
            <div>📈 مانده کل: <b>{money(stats.balance)}</b></div>
          </section>

          <section className="grid">
            <button className="card red" onClick={() => setPage('debt')}>ثبت بدهی</button>
            <button className="card green" onClick={() => setPage('payment')}>ثبت پرداخت</button>
            <button className="card blue" onClick={() => setPage('customers')}>مشتری‌ها</button>
            <button className="card purple" onClick={() => setPage('today')}>امروز</button>
          </section>
        </>
      )}

      {page === 'debt' && <TransactionForm title="ثبت بدهی جدید" type="debt" onSaved={loadStats} />}
      {page === 'payment' && <TransactionForm title="ثبت پرداخت جدید" type="payment" onSaved={loadStats} />}

      {page === 'customers' && !selectedCustomer && (
        <Customers onSelect={setSelectedCustomer} />
      )}

      {page === 'customers' && selectedCustomer && (
        <CustomerDetails name={selectedCustomer} onBack={() => setSelectedCustomer(null)} onChanged={loadStats} />
      )}

      {page === 'today' && <History title="گزارش امروز" onlyToday />}
    </main>
  )
}

function CustomerNameInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [customers, setCustomers] = useState<string[]>([])
  const [show, setShow] = useState(false)

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from('customers').select('name').eq('store_id', getStoreId()).order('name')
      setCustomers((data || []).map((x: any) => x.name))
    }
    load()
  }, [])

  const q = value.trim()
  const list = customers
    .filter(name => !q || name.includes(q))
    .slice(0, 8)

  return (
    <div className="suggestBox">
      <input
        value={value}
        onChange={e => {
          onChange(e.target.value)
          setShow(true)
        }}
        onFocus={() => setShow(true)}
        placeholder="نام مشتری"
      />

      {show && list.length > 0 && (
        <div className="suggestList">
          {list.map(name => (
            <button
              key={name}
              type="button"
              onClick={() => {
                onChange(name)
                setShow(false)
              }}
            >
              {name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function TransactionForm({ title, type, onSaved }: { title: string; type: TxType; onSaved: () => void }) {
  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [message, setMessage] = useState('')

  async function save() {
    const cleanName = name.trim()
    const cleanAmount = Number(amount.replaceAll(',', '').trim())

    if (!cleanName || !cleanAmount) {
      setMessage('نام مشتری و مبلغ را وارد کن')
      return
    }

    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .upsert({ name: cleanName, store_id: getStoreId() }, { onConflict: 'store_id,name' })
      .select()
      .single()

    if (customerError || !customer) {
      setMessage('خطا در ثبت مشتری: ' + (customerError?.message || 'store_id پیدا نشد'))
      return
    }

    const { error } = await supabase.from('transactions').insert({
      customer_id: customer.id,
      customer_name: cleanName,
      store_id: getStoreId(),
      type,
      amount: cleanAmount,
      description: description.trim() || null
    })

    if (error) setMessage('خطا: ' + error.message)
    else {
      setMessage('ثبت شد ✅')
      setName('')
      setAmount('')
      setDescription('')
      onSaved()
    }
  }

  return (
    <section className="form">
      <h2>{title}</h2>

      <CustomerNameInput value={name} onChange={setName} />

      <input
        value={amount}
        onChange={e => setAmount(e.target.value)}
        placeholder="مبلغ"
        inputMode="numeric"
      />

      <input
        value={description}
        onChange={e => setDescription(e.target.value)}
        placeholder="شرح"
      />

      <button className="save" onClick={save}>ثبت</button>
      {message && <p>{message}</p>}
    </section>
  )
}

function Customers({ onSelect }: { onSelect: (name: string) => void }) {
  const [items, setItems] = useState<CustomerBalance[]>([])
  const [search, setSearch] = useState('')

  async function load() {
    const { data } = await supabase.from('transactions').select('customer_name,type,amount').eq('store_id', getStoreId())
    const map = new Map<string, CustomerBalance>()

    ;(data || []).forEach((tx: any) => {
      const name = tx.customer_name
      if (!map.has(name)) map.set(name, { name, debt: 0, payment: 0, balance: 0 })
      const item = map.get(name)!
      if (tx.type === 'debt') item.debt += Number(tx.amount)
      if (tx.type === 'payment') item.payment += Number(tx.amount)
      item.balance = item.debt - item.payment
    })

    setItems([...map.values()].sort((a, b) => b.balance - a.balance))
  }

  useEffect(() => {
    load()
  }, [])

  return (
    <section className="form">
      <h2>مشتری‌ها</h2>

      <input
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="جستجوی مشتری..."
      />

      <div className="list">
        {items.filter(x => x.name.includes(search.trim())).map(item => (
          <div className="customerCard" key={item.name}>
            <button className="rowButton" onClick={() => onSelect(item.name)}>
              <strong>{item.name}</strong>
              <span>{money(item.balance)}</span>
              <small>بدهی: {money(item.debt)} | پرداخت: {money(item.payment)}</small>
            </button>
          </div>
        ))}
      </div>
    </section>
  )
}

function CustomerDetails({ name, onBack, onChanged }: { name: string; onBack: () => void; onChanged: () => void }) {
  const [items, setItems] = useState<Tx[]>([])
  const [newName, setNewName] = useState(name)

  async function load() {
    const { data } = await supabase
      .from('transactions')
      .select('*')
      .eq('store_id', getStoreId())
      .eq('customer_name', name).eq('store_id', getStoreId())
      .order('created_at', { ascending: false })

    setItems((data || []) as Tx[])
  }

  useEffect(() => {
    load()
  }, [name])

  const debt = items.filter(x => x.type === 'debt').reduce((s, x) => s + Number(x.amount), 0)
  const payment = items.filter(x => x.type === 'payment').reduce((s, x) => s + Number(x.amount), 0)

  async function rename() {
    const clean = newName.trim()
    if (!clean) return

    await supabase.from('customers').upsert({ name: clean, store_id: getStoreId() }, { onConflict: 'store_id,name' })
    await supabase.from('transactions').update({ customer_name: clean }).eq('customer_name', name).eq('store_id', getStoreId())

    onChanged()
    onBack()
  }

  async function removeCustomer() {
    if (!confirm('همه تراکنش‌های این مشتری حذف شود؟')) return
    await supabase.from('transactions').delete().eq('customer_name', name).eq('store_id', getStoreId())
    onChanged()
    onBack()
  }

  return (
    <section className="form">
      <h2>{name}</h2>
      <div className="summary">
        <p>بدهی: {money(debt)}</p>
        <p>پرداخت: {money(payment)}</p>
        <h3>مانده: {money(debt - payment)}</h3>
      </div>

      <input value={newName} onChange={e => setNewName(e.target.value)} />
      <button className="save" onClick={rename}>ویرایش نام</button>
      <button className="danger" onClick={removeCustomer}>حذف مشتری</button>

      <button className="back" onClick={onBack}>برگشت به لیست</button>

      <div className="list">
        {items.map(item => (
          <div className="row" key={item.id}>
            <div>
              <strong>{item.type === 'debt' ? 'بدهی' : 'پرداخت'}</strong>
              <p>{item.description || 'بدون شرح'}</p>
            </div>
            <b className={item.type === 'debt' ? 'debtText' : 'payText'}>
              {item.type === 'debt' ? '+' : '-'} {money(item.amount)}
            </b>
          </div>
        ))}
      </div>
    </section>
  )
}

function History({ title, onlyToday }: { title: string; onlyToday?: boolean }) {
  const [items, setItems] = useState<Tx[]>([])

  async function load() {
    let query = supabase.from('transactions').select('*').eq('store_id', getStoreId()).order('created_at', { ascending: false })

    if (onlyToday) {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      query = query.gte('created_at', today.toISOString())
    }

    const { data } = await query
    setItems((data || []) as Tx[])
  }

  useEffect(() => {
    load()
  }, [])

  const debt = items.filter(x => x.type === 'debt').reduce((s, x) => s + Number(x.amount), 0)
  const payment = items.filter(x => x.type === 'payment').reduce((s, x) => s + Number(x.amount), 0)

  return (
    <section className="form">
      <h2>{title}</h2>

      <div className="summary">
        <p>بدهی: {money(debt)}</p>
        <p>پرداخت: {money(payment)}</p>
        <h3>مانده: {money(debt - payment)}</h3>
      </div>

      <div className="list">
        {items.map(item => (
          <div className="row" key={item.id}>
            <div>
              <strong>{item.customer_name}</strong>
              <p>{item.description || (item.type === 'debt' ? 'بدهی' : 'پرداخت')}</p>
            </div>
            <b className={item.type === 'debt' ? 'debtText' : 'payText'}>
              {item.type === 'debt' ? '+' : '-'} {money(item.amount)}
            </b>
          </div>
        ))}
      </div>
    </section>
  )
}

let voiceRecognition: any = null

function VoiceAssistant({ setPage, loadStats }: { setPage: (p: Page) => void; loadStats: () => void }) {
  const [listening, setListening] = useState(false)
  const [message, setMessage] = useState('فرمان صوتی خاموش است')

  function normalize(v: string) {
    return v
      .replaceAll('ي', 'ی')
      .replaceAll('ك', 'ک')
      .replace(/[۰-۹]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
      .trim()
  }

  function getAmount(text: string) {
    const n = normalize(text)
    const match = n.match(/\d+/)
    let amount = match ? Number(match[0]) : 0
    if (!amount && n.includes('بیست')) amount = 20
    if (!amount && n.includes('پنجاه')) amount = 50
    if (!amount && n.includes('صد')) amount = 100
    if (!amount) return 0
    if (n.includes('میلیون')) amount *= 1000000
    else if (n.includes('هزار')) amount *= 1000
    return amount
  }

  function getName(text: string) {
    return normalize(text)
      .replace(/سامان|برای|از|به|حساب|بدهی|نسیه|پرداخت|دریافت|گرفتم|داد|ثبت|کن|کرد|تومان|هزار|میلیون|اضافه/g, ' ')
      .replace(/\d+/g, ' ')
      .replace(/بیست|پنجاه|صد/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  }

  async function saveVoice(type: TxType, name: string, amount: number) {
    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .upsert({ name, store_id: getStoreId() }, { onConflict: 'store_id,name' })
      .select()
      .single()

    if (customerError || !customer) {
      setMessage('خطا در ساخت مشتری: ' + (customerError?.message || 'store_id پیدا نشد'))
      return
    }

    const { error } = await supabase.from('transactions').insert({
      customer_id: customer.id,
      customer_name: name,
      store_id: getStoreId(),
      type,
      amount,
      description: 'ثبت با فرمان صوتی'
    })

    if (error) setMessage('خطا: ' + error.message)
    else {
      setMessage(`${type === 'debt' ? 'بدهی' : 'پرداخت'} برای ${name} ثبت شد`)
      loadStats()
    }
  }

  async function handleCommand(raw: string) {
    const text = normalize(raw)
    if (!text.includes('سامان')) return

    if (text.includes('گزارش') || text.includes('امروز')) {
      setPage('today')
      setMessage('گزارش امروز باز شد')
      return
    }

    if (text.includes('مشتری')) {
      setPage('customers')
      setMessage('صفحه مشتری‌ها باز شد')
      return
    }

    const type: TxType | null =
      text.includes('پرداخت') || text.includes('دریافت') || text.includes('گرفتم')
        ? 'payment'
        : text.includes('بدهی') || text.includes('نسیه') || text.includes('اضافه') || text.includes('حساب')
          ? 'debt'
          : null

    const amount = getAmount(text)
    const name = getName(text)

    if (!type || !amount || !name) {
      setMessage('فرمان کامل نبود. مثلا بگو: سامان به حساب اکبرعلی ۲۰ هزار اضافه کن')
      return
    }

    await saveVoice(type, name, amount)
  }

  function startVoice() {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognition) {
      alert('مرورگر شما فرمان صوتی را پشتیبانی نمی‌کند. با Chrome امتحان کن.')
      return
    }

    const recognition = new SpeechRecognition()
    voiceRecognition = recognition
    recognition.lang = 'fa-IR'
    recognition.continuous = true
    recognition.interimResults = false

    recognition.onresult = (e: any) => {
      const text = e.results[e.results.length - 1][0].transcript
      setMessage('شنیدم: ' + text)
      handleCommand(text)
    }

    recognition.onend = () => {
      if (voiceRecognition === recognition) {
        try { recognition.start() } catch {}
      }
    }

    recognition.start()
    setListening(true)
    setMessage('گوش می‌دهم... اول بگو سامان')
  }

  function stopVoice() {
    if (voiceRecognition) {
      const r = voiceRecognition
      voiceRecognition = null
      try { r.stop() } catch {}
    }
    setListening(false)
    setMessage('فرمان صوتی خاموش شد')
  }

  return (
    <div className="voiceBox">
      <button className={listening ? 'voiceBtn activeVoice' : 'voiceBtn'} onClick={listening ? stopVoice : startVoice}>
        {listening ? 'خاموش کردن فرمان صوتی' : 'فعال‌سازی فرمان صوتی'}
      </button>
      <p>{message}</p>
    </div>
  )
}

export default App
