import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import '../App.css'

type Page = 'home' | 'debt' | 'payment' | 'customers' | 'today' | 'about'
type TxType = 'debt' | 'payment'

type Tx = {
  id: string
  customer_id: string | null
  customer_name: string
  type: TxType
  amount: number
  description: string | null
  created_at: string
}

type Customer = {
  id: string
  name: string
}

type CustomerBalance = Customer & {
  debt: number
  payment: number
  balance: number
}

type ParsedVoiceCommand = {
  type: TxType
  amount: number
  customerName: string
  description: string
}

const VERSION = '0.8.0'

function getStoreId() {
  const id = localStorage.getItem('store_id')
  if (!id) throw new Error('شناسه فروشگاه پیدا نشد. یک بار خارج و دوباره وارد شوید.')
  return id
}

function normalizeText(value: string) {
  return value
    .replaceAll('ي', 'ی')
    .replaceAll('ك', 'ک')
    .replaceAll('ۀ', 'ه')
    .replace(/[۰-۹]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[٬,]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function compactText(value: string) {
  return normalizeText(value).replace(/\s/g, '')
}

function money(value: number) {
  return Number(value || 0).toLocaleString('fa-IR') + ' تومان'
}

function parsePersianNumber(input: string) {
  const normalized = normalizeText(input)
  const digitMatch = normalized.match(/\d+(?:\.\d+)?/)
  if (digitMatch) {
    let number = Number(digitMatch[0])
    const after = normalized.slice(digitMatch.index || 0)
    if (/میلیون/.test(after)) number *= 1_000_000
    else if (/هزار/.test(after)) number *= 1_000
    return Math.round(number)
  }

  const small: Record<string, number> = {
    صفر: 0, یک: 1, یه: 1, دو: 2, سه: 3, چهار: 4, پنج: 5, شش: 6, هفت: 7, هشت: 8, نه: 9,
    ده: 10, یازده: 11, دوازده: 12, سیزده: 13, چهارده: 14, پانزده: 15, شانزده: 16,
    هفده: 17, هجده: 18, نوزده: 19, بیست: 20, سی: 30, چهل: 40, پنجاه: 50,
    شصت: 60, هفتاد: 70, هشتاد: 80, نود: 90, صد: 100, یکصد: 100,
    دویست: 200, سیصد: 300, چهارصد: 400, پانصد: 500, ششصد: 600, هفتصد: 700,
    هشتصد: 800, نهصد: 900
  }

  const tokens = normalized.split(' ')
  let total = 0
  let current = 0
  let found = false

  for (const token of tokens) {
    if (token === 'و') continue
    if (token in small) {
      current += small[token]
      found = true
    } else if (token === 'هزار') {
      current = (current || 1) * 1_000
      total += current
      current = 0
      found = true
    } else if (token === 'میلیون') {
      current = (current || 1) * 1_000_000
      total += current
      current = 0
      found = true
    }
  }

  return found ? total + current : 0
}

function App() {
  const [page, setPage] = useState<Page>('home')
  const [stats, setStats] = useState({ customers: 0, debt: 0, payment: 0, balance: 0 })
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)

  async function loadStats() {
    try {
      const storeId = getStoreId()
      const [{ data: customers }, { data: transactions }] = await Promise.all([
        supabase.from('customers').select('id').eq('store_id', storeId),
        supabase.from('transactions').select('type,amount').eq('store_id', storeId)
      ])

      let debt = 0
      let payment = 0
      ;(transactions || []).forEach((tx: any) => {
        if (tx.type === 'debt') debt += Number(tx.amount)
        if (tx.type === 'payment') payment += Number(tx.amount)
      })

      setStats({ customers: customers?.length || 0, debt, payment, balance: debt - payment })
    } catch (error: any) {
      console.error(error)
    }
  }

  useEffect(() => { loadStats() }, [])

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
            <button className="card aboutCard" onClick={() => setPage('about')}>درباره برنامه</button>
          </section>
        </>
      )}

      {page === 'debt' && <TransactionForm title="ثبت بدهی جدید" type="debt" onSaved={loadStats} />}
      {page === 'payment' && <TransactionForm title="ثبت پرداخت جدید" type="payment" onSaved={loadStats} />}
      {page === 'customers' && !selectedCustomer && <Customers onSelect={setSelectedCustomer} />}
      {page === 'customers' && selectedCustomer && (
        <CustomerDetails customer={selectedCustomer} onBack={() => setSelectedCustomer(null)} onChanged={loadStats} />
      )}
      {page === 'today' && <History title="گزارش امروز" onlyToday />}
      {page === 'about' && <AboutPage />}
    </main>
  )
}

function CustomerNameInput({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [show, setShow] = useState(false)

  useEffect(() => {
    supabase
      .from('customers')
      .select('id,name')
      .eq('store_id', getStoreId())
      .order('name')
      .then(({ data }) => setCustomers((data || []) as Customer[]))
  }, [])

  const query = compactText(value)
  const suggestions = customers
    .filter(customer => !query || compactText(customer.name).includes(query))
    .slice(0, 10)

  return (
    <div className="suggestBox">
      <input
        value={value}
        onChange={event => { onChange(event.target.value); setShow(true) }}
        onFocus={() => setShow(true)}
        onBlur={() => window.setTimeout(() => setShow(false), 150)}
        placeholder="نام مشتری"
        autoComplete="off"
      />
      {show && suggestions.length > 0 && (
        <div className="suggestList">
          {suggestions.map(customer => (
            <button key={customer.id} type="button" onMouseDown={() => { onChange(customer.name); setShow(false) }}>
              {customer.name}
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
  const [saving, setSaving] = useState(false)

  async function save() {
    const cleanName = normalizeText(name)
    const cleanAmount = Number(normalizeText(amount))
    if (!cleanName || !cleanAmount || cleanAmount <= 0) return setMessage('نام مشتری و مبلغ معتبر را وارد کنید.')

    setSaving(true)
    setMessage('در حال ثبت...')
    const storeId = getStoreId()

    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .upsert({ name: cleanName, store_id: storeId }, { onConflict: 'store_id,name' })
      .select('id,name')
      .single()

    if (customerError || !customer) {
      setSaving(false)
      return setMessage('خطا در ثبت مشتری: ' + (customerError?.message || 'خطای نامشخص'))
    }

    const { error } = await supabase.from('transactions').insert({
      customer_id: customer.id,
      customer_name: customer.name,
      store_id: storeId,
      type,
      amount: cleanAmount,
      description: description.trim() || null
    })

    setSaving(false)
    if (error) return setMessage('خطا: ' + error.message)

    setMessage('ثبت شد ✅')
    setName('')
    setAmount('')
    setDescription('')
    onSaved()
  }

  return (
    <section className="form">
      <h2>{title}</h2>
      <CustomerNameInput value={name} onChange={setName} />
      <input value={amount} onChange={e => setAmount(e.target.value)} placeholder="مبلغ" inputMode="numeric" />
      <input value={description} onChange={e => setDescription(e.target.value)} placeholder="شرح اقلام یا توضیحات" />
      <button className="save" disabled={saving} onClick={save}>{saving ? 'در حال ثبت...' : 'ثبت'}</button>
      {message && <p>{message}</p>}
    </section>
  )
}

function Customers({ onSelect }: { onSelect: (customer: Customer) => void }) {
  const [items, setItems] = useState<CustomerBalance[]>([])
  const [search, setSearch] = useState('')

  async function load() {
    const storeId = getStoreId()
    const [{ data: customers }, { data: transactions }] = await Promise.all([
      supabase.from('customers').select('id,name').eq('store_id', storeId).order('name'),
      supabase.from('transactions').select('customer_id,customer_name,type,amount').eq('store_id', storeId)
    ])

    const map = new Map<string, CustomerBalance>()
    ;(customers || []).forEach((customer: any) => map.set(customer.id, { ...customer, debt: 0, payment: 0, balance: 0 }))
    ;(transactions || []).forEach((tx: any) => {
      const key = tx.customer_id || tx.customer_name
      let customer = map.get(key)
      if (!customer) {
        customer = { id: key, name: tx.customer_name, debt: 0, payment: 0, balance: 0 }
        map.set(key, customer)
      }
      if (tx.type === 'debt') customer.debt += Number(tx.amount)
      if (tx.type === 'payment') customer.payment += Number(tx.amount)
      customer.balance = customer.debt - customer.payment
    })

    setItems([...map.values()].sort((a, b) => b.balance - a.balance))
  }

  useEffect(() => { load() }, [])

  const filtered = useMemo(() => {
    const query = compactText(search)
    return items.filter(item => compactText(item.name).includes(query))
  }, [items, search])

  return (
    <section className="form">
      <h2>مشتری‌ها</h2>
      <input value={search} onChange={e => setSearch(e.target.value)} placeholder="جستجوی مشتری..." />
      <div className="list">
        {filtered.map(item => (
          <button className="customerCard customerClickable" key={item.id} onClick={() => onSelect({ id: item.id, name: item.name })}>
            <div className="customerTitle"><strong>{item.name}</strong><span>{money(item.balance)}</span></div>
            <small>بدهی: {money(item.debt)} | پرداخت: {money(item.payment)}</small>
            <em>برای مشاهده و ویرایش حساب لمس کنید</em>
          </button>
        ))}
      </div>
    </section>
  )
}

function CustomerDetails({ customer, onBack, onChanged }: { customer: Customer; onBack: () => void; onChanged: () => void }) {
  const [items, setItems] = useState<Tx[]>([])
  const [newName, setNewName] = useState(customer.name)
  const [editing, setEditing] = useState<Tx | null>(null)
  const [editAmount, setEditAmount] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [message, setMessage] = useState('')

  async function load() {
    const { data } = await supabase
      .from('transactions')
      .select('*')
      .eq('store_id', getStoreId())
      .eq('customer_id', customer.id)
      .order('created_at', { ascending: false })
    setItems((data || []) as Tx[])
  }

  useEffect(() => { load() }, [customer.id])

  const debt = items.filter(x => x.type === 'debt').reduce((sum, x) => sum + Number(x.amount), 0)
  const payment = items.filter(x => x.type === 'payment').reduce((sum, x) => sum + Number(x.amount), 0)

  async function rename() {
    const clean = normalizeText(newName)
    if (!clean || clean === customer.name) return
    const storeId = getStoreId()

    const { error } = await supabase.from('customers').update({ name: clean }).eq('id', customer.id).eq('store_id', storeId)
    if (error) return setMessage('خطا در ویرایش نام: ' + error.message)

    await supabase.from('transactions').update({ customer_name: clean }).eq('customer_id', customer.id).eq('store_id', storeId)
    setMessage('نام مشتری ویرایش شد ✅')
    onChanged()
    window.setTimeout(onBack, 500)
  }

  async function removeCustomer() {
    if (!confirm('این مشتری و همه تراکنش‌های او حذف شود؟')) return
    const storeId = getStoreId()
    await supabase.from('transactions').delete().eq('customer_id', customer.id).eq('store_id', storeId)
    await supabase.from('customers').delete().eq('id', customer.id).eq('store_id', storeId)
    onChanged()
    onBack()
  }

  function startEdit(item: Tx) {
    setEditing(item)
    setEditAmount(String(item.amount))
    setEditDescription(item.description || '')
  }

  async function saveEdit() {
    if (!editing) return
    const amount = Number(normalizeText(editAmount))
    if (!amount || amount <= 0) return setMessage('مبلغ معتبر وارد کنید.')

    const { error } = await supabase
      .from('transactions')
      .update({ amount, description: editDescription.trim() || null })
      .eq('id', editing.id)
      .eq('store_id', getStoreId())

    if (error) return setMessage('خطا در ویرایش تراکنش: ' + error.message)
    setEditing(null)
    setMessage('تراکنش ویرایش شد ✅')
    await load()
    onChanged()
  }

  async function removeTransaction(item: Tx) {
    if (!confirm('این تراکنش حذف شود؟')) return
    const { error } = await supabase.from('transactions').delete().eq('id', item.id).eq('store_id', getStoreId())
    if (error) return setMessage('خطا در حذف تراکنش: ' + error.message)
    await load()
    onChanged()
  }

  return (
    <section className="form">
      <button className="back small" onClick={onBack}>برگشت به مشتری‌ها</button>
      <h2>{customer.name}</h2>
      <div className="summary">
        <p>جمع بدهی: {money(debt)}</p><p>جمع پرداخت: {money(payment)}</p><h3>مانده: {money(debt - payment)}</h3>
      </div>

      <div className="customerEditBox">
        <h3>ویرایش اطلاعات مشتری</h3>
        <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="نام و نام خانوادگی" />
        <button className="save" onClick={rename}>ذخیره تغییرات مشتری</button>
        <button className="danger" onClick={removeCustomer}>حذف مشتری</button>
      </div>

      {editing && (
        <div className="editBox">
          <h3>ویرایش تراکنش</h3>
          <input value={editAmount} onChange={e => setEditAmount(e.target.value)} placeholder="مبلغ" inputMode="numeric" />
          <input value={editDescription} onChange={e => setEditDescription(e.target.value)} placeholder="شرح" />
          <button className="save" onClick={saveEdit}>ذخیره ویرایش</button>
          <button className="back small" onClick={() => setEditing(null)}>لغو</button>
        </div>
      )}

      {message && <p>{message}</p>}
      <div className="list">
        {items.map(item => (
          <div className="row" key={item.id}>
            <div>
              <strong>{item.type === 'debt' ? 'بدهی' : 'پرداخت'}</strong>
              <p>{item.description || 'بدون شرح'}</p>
              <small>{new Date(item.created_at).toLocaleString('fa-IR')}</small>
            </div>
            <div>
              <b className={item.type === 'debt' ? 'debtText' : 'payText'}>{item.type === 'debt' ? '+' : '-'} {money(item.amount)}</b>
              <div className="actions">
                <button className="editBtn" onClick={() => startEdit(item)}>ویرایش</button>
                <button className="danger" onClick={() => removeTransaction(item)}>حذف</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

function History({ title, onlyToday }: { title: string; onlyToday?: boolean }) {
  const [items, setItems] = useState<Tx[]>([])

  useEffect(() => {
    let query = supabase.from('transactions').select('*').eq('store_id', getStoreId()).order('created_at', { ascending: false })
    if (onlyToday) {
      const today = new Date(); today.setHours(0, 0, 0, 0)
      query = query.gte('created_at', today.toISOString())
    }
    query.then(({ data }) => setItems((data || []) as Tx[]))
  }, [onlyToday])

  const debt = items.filter(x => x.type === 'debt').reduce((sum, x) => sum + Number(x.amount), 0)
  const payment = items.filter(x => x.type === 'payment').reduce((sum, x) => sum + Number(x.amount), 0)

  return (
    <section className="form">
      <h2>{title}</h2>
      <div className="summary"><p>بدهی: {money(debt)}</p><p>پرداخت: {money(payment)}</p><h3>مانده: {money(debt - payment)}</h3></div>
      <div className="list">
        {items.map(item => (
          <div className="row" key={item.id}>
            <div><strong>{item.customer_name}</strong><p>{item.description || (item.type === 'debt' ? 'بدهی' : 'پرداخت')}</p><small>{new Date(item.created_at).toLocaleString('fa-IR')}</small></div>
            <b className={item.type === 'debt' ? 'debtText' : 'payText'}>{item.type === 'debt' ? '+' : '-'} {money(item.amount)}</b>
          </div>
        ))}
      </div>
    </section>
  )
}

function AboutPage() {
  return (
    <section className="form aboutPage">
      <div className="aboutLogo">ح</div>
      <h2>سامان حساب</h2>
      <p>دفتر هوشمند مدیریت حساب مشتریان و فروشگاه‌ها</p>
      <div className="summary">
        <p>نسخه: <b>{VERSION}</b></p>
        <p>توسعه و طراحی</p>
        <h3>سامان رفیعی</h3>
        <p>شماره تماس: <b>۰۹۳۹۷۱۸۵۲۰۵</b></p>
      </div>
      <a className="save linkBtn" href="tel:09397185205">تماس با توسعه‌دهنده</a>
      <button className="editBtn" onClick={() => window.location.reload()}>بررسی بروزرسانی</button>
      <p className="copyright">تمام حقوق این نرم‌افزار متعلق به سامان رفیعی است.</p>
    </section>
  )
}

let voiceRecognition: any = null

function VoiceAssistant({ setPage, loadStats }: { setPage: (page: Page) => void; loadStats: () => void }) {
  const [listening, setListening] = useState(false)
  const [message, setMessage] = useState('فرمان صوتی خاموش است')

  async function loadCustomers() {
    const { data } = await supabase.from('customers').select('id,name').eq('store_id', getStoreId())
    return (data || []) as Customer[]
  }

  function findCustomerName(text: string, customers: Customer[]) {
    const normalized = compactText(text)
    const matched = [...customers]
      .sort((a, b) => b.name.length - a.name.length)
      .find(customer => normalized.includes(compactText(customer.name)))
    if (matched) return matched.name

    const cueMatch = normalizeText(text).match(/(?:برای|به حساب|حساب|از)\s+(.+?)(?=\s+(?:مبلغ|\d|یک|دو|سه|چهار|پنج|شش|هفت|هشت|نه|ده|بیست|سی|چهل|پنجاه|صد|هزار|میلیون|بدهی|پرداخت|نسیه|ثبت|اضافه|کم)|$)/)
    if (cueMatch?.[1]) return cueMatch[1].trim()

    return ''
  }

  async function parseCommand(raw: string): Promise<ParsedVoiceCommand | null> {
    const text = normalizeText(raw)
    if (!text.includes('حسابدار')) return null

    const paymentWords = /پرداخت|تسویه|دریافت|گرفتم|واریز|داد|کم کن|کم شود/
    const debtWords = /بدهی|نسیه|برد|خرید|اضافه کن|اضافه شود|ثبت کن/
    const type: TxType = paymentWords.test(text) ? 'payment' : debtWords.test(text) ? 'debt' : 'debt'
    const amount = parsePersianNumber(text)
    const customers = await loadCustomers()
    const customerName = findCustomerName(text, customers)

    if (!amount || !customerName) return null
    const timestamp = new Date().toLocaleString('fa-IR')
    return { type, amount, customerName, description: `فرمان صوتی: ${raw.trim()} | ${timestamp}` }
  }

  async function saveVoice(command: ParsedVoiceCommand) {
    const storeId = getStoreId()
    const customers = await loadCustomers()
    const existing = customers.find(customer => compactText(customer.name) === compactText(command.customerName))

    let customer = existing
    if (!customer) {
      const { data, error } = await supabase
        .from('customers')
        .upsert({ name: normalizeText(command.customerName), store_id: storeId }, { onConflict: 'store_id,name' })
        .select('id,name')
        .single()
      if (error || !data) return setMessage('خطا در ثبت مشتری: ' + (error?.message || 'نامشخص'))
      customer = data as Customer
    }

    const { error } = await supabase.from('transactions').insert({
      customer_id: customer.id,
      customer_name: customer.name,
      store_id: storeId,
      type: command.type,
      amount: command.amount,
      description: command.description
    })

    if (error) return setMessage('خطا: ' + error.message)
    setMessage(`${command.type === 'debt' ? 'بدهی' : 'پرداخت'} ${money(command.amount)} برای ${customer.name} ثبت شد ✅`)
    loadStats()
  }

  async function handleCommand(raw: string) {
    const text = normalizeText(raw)
    if (!text.includes('حسابدار')) return
    if (/گزارش|امروز/.test(text)) { setPage('today'); return setMessage('گزارش امروز باز شد') }
    if (/مشتری/.test(text) && !/بدهی|پرداخت|نسیه|مبلغ|تومان|هزار|میلیون/.test(text)) { setPage('customers'); return setMessage('صفحه مشتری‌ها باز شد') }

    const parsed = await parseCommand(raw)
    if (!parsed) return setMessage('فرمان کامل نبود. مثال: حسابدار صد هزار تومان پفک و چیپس برای رضا حیدروند ثبت کن')
    await saveVoice(parsed)
  }

  function startVoice() {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognition) return alert('مرورگر شما فرمان صوتی را پشتیبانی نمی‌کند. با Chrome امتحان کنید.')

    const recognition = new SpeechRecognition()
    voiceRecognition = recognition
    recognition.lang = 'fa-IR'
    recognition.continuous = true
    recognition.interimResults = false
    recognition.onresult = (event: any) => {
      const text = event.results[event.results.length - 1][0].transcript
      setMessage('شنیدم: ' + text)
      handleCommand(text)
    }
    recognition.onerror = (event: any) => setMessage('خطای میکروفون: ' + event.error)
    recognition.onend = () => { if (voiceRecognition === recognition) try { recognition.start() } catch {} }
    recognition.start()
    setListening(true)
    setMessage('گوش می‌دهم... فرمان را با «حسابدار» شروع کنید')
  }

  function stopVoice() {
    const current = voiceRecognition
    voiceRecognition = null
    if (current) try { current.stop() } catch {}
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
