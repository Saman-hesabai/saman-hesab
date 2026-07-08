import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import './App.css'

type Page = 'home' | 'debt' | 'payment' | 'customers' | 'today'
type Tx = {
  id: string
  customer_name: string
  type: 'debt' | 'payment'
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

function App() {
  const [page, setPage] = useState<Page>('home')
  const [stats, setStats] = useState({ customers: 0, debt: 0, payment: 0, balance: 0 })

  useEffect(() => {
    loadStats()
  }, [])

  async function loadStats() {
    const { data } = await supabase.from('transactions').select('customer_name,type,amount')
    const names = new Set<string>()
    let debt = 0
    let payment = 0

    ;(data || []).forEach((tx: any) => {
      names.add(tx.customer_name)
      if (tx.type === 'debt') debt += Number(tx.amount)
      if (tx.type === 'payment') payment += Number(tx.amount)
    })

    setStats({
      customers: names.size,
      debt,
      payment,
      balance: debt - payment
    })
  }
  const [selectedCustomer, setSelectedCustomer] = useState<string | null>(null)

  function goHome() {
    setPage('home')
    setSelectedCustomer(null)
  }

  return (
    <main className="app" dir="rtl">
      {page !== 'home' && <button className="back" onClick={goHome}>بازگشت</button>}

      {page === 'home' && (
        <>
          <header>
            <h1>سامان حساب</h1>
            <p>دفتر نسیه هوشمند فروشگاه</p>
          </header>
          <section className="stats">
            <div>👥 مشتری‌ها: <b>{stats.customers.toLocaleString('fa-IR')}</b></div>
            <div>💰 بدهی کل: <b>{stats.debt.toLocaleString('fa-IR')} تومان</b></div>
            <div>💵 پرداخت کل: <b>{stats.payment.toLocaleString('fa-IR')} تومان</b></div>
            <div>📈 مانده کل: <b>{stats.balance.toLocaleString('fa-IR')} تومان</b></div>
          </section>

          <section className="grid">
            <button className="card red" onClick={() => setPage('debt')}>ثبت بدهی</button>
            <button className="card green" onClick={() => setPage('payment')}>ثبت پرداخت</button>
            <button className="card blue" onClick={() => setPage('customers')}>مشتری‌ها</button>
            <button className="card purple" onClick={() => setPage('today')}>امروز</button>
          </section>
        </>
      )}

      {page === 'debt' && <TransactionForm title="ثبت بدهی" type="debt" />}
      {page === 'payment' && <TransactionForm title="ثبت پرداخت" type="payment" />}
      {page === 'customers' && !selectedCustomer && (
        <Customers onSelect={setSelectedCustomer} />
      )}
      {page === 'customers' && selectedCustomer && (
        <CustomerDetails name={selectedCustomer} onBack={() => setSelectedCustomer(null)} />
      )}
      {page === 'today' && <History title="تاریخچه ثبت‌ها" />}
    </main>
  )
}

function TransactionForm({ title, type }: { title: string; type: 'debt' | 'payment' }) {
  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [message, setMessage] = useState('')

  async function save() {
    setMessage('در حال ثبت...')
    const cleanName = name.trim()
    const cleanAmount = Number(amount.replaceAll(',', '').trim())

    if (!cleanName || !cleanAmount) {
      setMessage('نام مشتری و مبلغ را وارد کن.')
      return
    }

    const { data: customer } = await supabase
      .from('customers')
      .upsert({ name: cleanName }, { onConflict: 'name' })
      .select()
      .single()

    if (!customer) {
      setMessage('خطا در ثبت مشتری')
      return
    }

    const { error } = await supabase.from('transactions').insert({
      customer_id: customer.id,
      customer_name: cleanName,
      type,
      amount: cleanAmount,
      description
    })

    if (error) setMessage('خطا: ' + error.message)
    else {
      setMessage('ثبت شد ✅')
      setName('')
      setAmount('')
      setDescription('')
    }
  }

  return (
    <section className="form">
      <h2>{title}</h2>
      <input value={name} onChange={e => setName(e.target.value)} placeholder="نام مشتری" />
      <input value={amount} onChange={e => setAmount(e.target.value)} placeholder="مبلغ به تومان" inputMode="numeric" />
      <input value={description} onChange={e => setDescription(e.target.value)} placeholder="شرح اختیاری" />
      <button className="save" onClick={save}>ثبت</button>
      {message && <p>{message}</p>}
    </section>
  )
}

function Customers({ onSelect }: { onSelect: (name: string) => void }) {
  const [items, setItems] = useState<CustomerBalance[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    const { data } = await supabase.from('transactions').select('customer_name,type,amount')
    const map = new Map<string, CustomerBalance>()

    ;(data || []).forEach((tx: any) => {
      const name = tx.customer_name
      if (!map.has(name)) map.set(name, { name, debt: 0, payment: 0, balance: 0 })
      const c = map.get(name)!
      if (tx.type === 'debt') c.debt += Number(tx.amount)
      if (tx.type === 'payment') c.payment += Number(tx.amount)
      c.balance = c.debt - c.payment
    })

    setItems(Array.from(map.values()).sort((a, b) => b.balance - a.balance))
    setLoading(false)
  }

  async function renameCustomer(oldName: string) {
    const newName = prompt('نام جدید مشتری را وارد کن:', oldName)
    if (!newName || !newName.trim() || newName.trim() === oldName) return

    const cleanName = newName.trim()

    await supabase
      .from('customers')
      .update({ name: cleanName })
      .eq('name', oldName)

    const { error } = await supabase
      .from('transactions')
      .update({ customer_name: cleanName })
      .eq('customer_name', oldName)

    if (error) {
      alert('خطا در ویرایش مشتری')
      return
    }

    await load()
  }

  async function removeCustomer(name: string) {
    if (!confirm('مشتری حذف شود؟ تمام تراکنش‌هایش هم حذف می‌شود.')) return

    const { error } = await supabase
      .from('transactions')
      .delete()
      .eq('customer_name', name)

    if (error) {
      alert('خطا در حذف مشتری')
      return
    }

    await load()
  }

  return (
    <section className="form">
      <h2>مشتری‌ها</h2>
      <input
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="جستجوی مشتری..."
      />

      {loading && <p>در حال دریافت...</p>}
      <div className="list">
        {items.filter(item => item.name.includes(search.trim())).map(item => (
          <button className="row rowButton" key={item.name} onClick={() => onSelect(item.name)}>
            <div>
              <strong>{item.name}</strong>
              <p>بدهی: {item.debt.toLocaleString('fa-IR')} | پرداخت: {item.payment.toLocaleString('fa-IR')}</p>
            </div>
            <b className={item.balance > 0 ? 'debtText' : 'payText'}>
              {item.balance.toLocaleString('fa-IR')} تومان
            </b>
            <button className="editBtn" onClick={(e) => { e.stopPropagation(); renameCustomer(item.name) }}>
              ویرایش نام
            </button>
            <button className="danger" onClick={(e) => { e.stopPropagation(); removeCustomer(item.name) }}>
              حذف مشتری
            </button>
          </button>
        ))}
      </div>
    </section>
  )
}

function CustomerDetails({ name, onBack }: { name: string; onBack: () => void }) {
  const [items, setItems] = useState<Tx[]>([])
  const [loading, setLoading] = useState(true)
  const [editingTx, setEditingTx] = useState<Tx | null>(null)
  const [editAmount, setEditAmount] = useState('')
  const [editDescription, setEditDescription] = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    const { data } = await supabase
      .from('transactions')
      .select('*')
      .eq('customer_name', name)
      .order('created_at', { ascending: false })

    setItems(data || [])
    setLoading(false)
  }

  const debt = items.filter(i => i.type === 'debt').reduce((s, i) => s + i.amount, 0)
  const payment = items.filter(i => i.type === 'payment').reduce((s, i) => s + i.amount, 0)
  const balance = debt - payment

  function startEdit(item: Tx) {
    setEditingTx(item)
    setEditAmount(String(item.amount))
    setEditDescription(item.description || '')
  }

  async function saveEdit() {
    if (!editingTx) return

    const { error } = await supabase
      .from('transactions')
      .update({
        amount: Number(editAmount.replaceAll(',', '').trim()),
        description: editDescription
      })
      .eq('id', editingTx.id)

    if (error) {
      alert('خطا در ویرایش')
      return
    }

    setEditingTx(null)
    await load()
  }

  async function removeTransaction(id: string) {
    if (!confirm('این تراکنش حذف شود؟')) return

    const { error } = await supabase
      .from('transactions')
      .delete()
      .eq('id', id)

    if (error) {
      alert('خطا در حذف')
      return
    }

    await load()
  }

  return (
    <section className="form">
      <button className="back small" onClick={onBack}>برگشت به مشتری‌ها</button>
      <h2>{name}</h2>
      <div className="summary">
        <p>جمع بدهی: {debt.toLocaleString('fa-IR')} تومان</p>
        <p>جمع پرداخت: {payment.toLocaleString('fa-IR')} تومان</p>
        <h3>مانده: {balance.toLocaleString('fa-IR')} تومان</h3>
      </div>

      {editingTx && (
        <div className="editBox">
          <h3>ویرایش تراکنش</h3>
          <input value={editAmount} onChange={e => setEditAmount(e.target.value)} placeholder="مبلغ" inputMode="numeric" />
          <input value={editDescription} onChange={e => setEditDescription(e.target.value)} placeholder="شرح" />
          <button className="save" onClick={saveEdit}>ذخیره ویرایش</button>
          <button className="back small" onClick={() => setEditingTx(null)}>لغو</button>
        </div>
      )}

      {loading && <p>در حال دریافت...</p>}
      <div className="list">
        {items.map(item => (
          <div className="row" key={item.id}>
            <div>
              <strong>{item.type === 'debt' ? 'بدهی' : 'پرداخت'}</strong>
              <p>{item.description || 'بدون شرح'}</p>
            </div>
            <div>
              <b className={item.type === 'debt' ? 'debtText' : 'payText'}>
                {item.type === 'debt' ? '+' : '-'} {item.amount.toLocaleString('fa-IR')} تومان
              </b>
              <button className="editBtn" onClick={() => startEdit(item)}>ویرایش</button>
              <button className="danger" onClick={() => removeTransaction(item.id)}>حذف</button>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

function History({ title }: { title: string }) {
  const [items, setItems] = useState<Tx[]>([])
  useEffect(() => { load() }, [])

  async function load() {
    const { data } = await supabase.from('transactions').select('*').order('created_at', { ascending: false }).limit(50)
    setItems(data || [])
  }

  return (
    <section className="form">
      <h2>{title}</h2>
      <div className="list">
        {items.map(item => (
          <div className="row" key={item.id}>
            <div>
              <strong>{item.customer_name}</strong>
              <p>{item.description || (item.type === 'debt' ? 'بدهی' : 'پرداخت')}</p>
            </div>
            <b className={item.type === 'debt' ? 'debtText' : 'payText'}>
              {item.type === 'debt' ? '+' : '-'} {item.amount.toLocaleString('fa-IR')} تومان
            </b>
          </div>
        ))}
      </div>
    </section>
  )
}

export default App
