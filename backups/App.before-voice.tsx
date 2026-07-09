import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import './App.css'

type Page = 'home' | 'debt' | 'payment' | 'customers' | 'today'

type Tx = {
  id: string
  customer_id: string | null
  customer_name: string
  type: 'debt' | 'payment'
  amount: number
  description: string | null
  created_at: string
}

type CustomerBalance = {
  id?: string
  name: string
  debt: number
  payment: number
  balance: number
}

function money(n: number) {
  return Number(n || 0).toLocaleString('fa-IR') + ' تومان'
}

function App() {
  const [page, setPage] = useState<Page>('home')
  const [stats, setStats] = useState({ customers: 0, debt: 0, payment: 0, balance: 0 })
  const [selectedCustomer, setSelectedCustomer] = useState<string | null>(null)

  useEffect(() => {
    loadStats()
  }, [])

  async function loadStats() {
    const { data } = await supabase
      .from('transactions')
      .select('customer_name,type,amount')

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
      balance: debt - payment,
    })
  }

  function goHome() {
    setPage('home')
    setSelectedCustomer(null)
    loadStats()
  }

  return (
    <main className="app" dir="rtl">
      {page !== 'home' && (
        <button className="back" onClick={goHome}>
          بازگشت
        </button>
      )}

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

      {page === 'debt' && <TransactionForm title="ثبت بدهی" type="debt" onSaved={loadStats} />}
      {page === 'payment' && <TransactionForm title="ثبت پرداخت" type="payment" onSaved={loadStats} />}

      {page === 'customers' && !selectedCustomer && (
        <Customers onSelect={setSelectedCustomer} />
      )}

      {page === 'customers' && selectedCustomer && (
        <CustomerDetails name={selectedCustomer} onBack={() => setSelectedCustomer(null)} />
      )}

      {page === 'today' && <History title="تاریخچه" />}
    </main>
  )
}

function TransactionForm({
  title,
  type,
  onSaved,
}: {
  title: string
  type: 'debt' | 'payment'
  onSaved: () => void
}) {
  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [message, setMessage] = useState('')

  async function save() {
    setMessage('در حال ثبت...')
    const cleanName = name.trim()
    const cleanAmount = Number(amount.replaceAll(',', '').trim())

    if (!cleanName || !cleanAmount) {
      setMessage('نام مشتری و مبلغ را وارد کن')
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
      description,
    })

    if (error) {
      setMessage('خطا: ' + error.message)
      return
    }

    setMessage('ثبت شد ✅')
    setName('')
    setAmount('')
    setDescription('')
    onSaved()
  }

  return (
    <section className="form">
      <h2>{title}</h2>

      <input value={name} onChange={e => setName(e.target.value)} placeholder="نام مشتری" />
      <input value={amount} onChange={e => setAmount(e.target.value)} placeholder="مبلغ" inputMode="numeric" />
      <input value={description} onChange={e => setDescription(e.target.value)} placeholder="شرح" />

      <button className="save" onClick={save}>ثبت</button>
      {message && <p>{message}</p>}
    </section>
  )
}

function Customers({ onSelect }: { onSelect: (name: string) => void }) {
  const [items, setItems] = useState<CustomerBalance[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    load()
  }, [])

  async function load() {
    setLoading(true)

    const { data } = await supabase
      .from('transactions')
      .select('customer_name,type,amount')

    const map = new Map<string, CustomerBalance>()

    ;(data || []).forEach((tx: any) => {
      const name = tx.customer_name
      if (!map.has(name)) {
        map.set(name, { name, debt: 0, payment: 0, balance: 0 })
      }

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

    await supabase
      .from('customers')
      .delete()
      .eq('name', name)

    if (error) {
      alert('خطا در حذف مشتری')
      return
    }

    await load()
  }

  function norm(v: string) {
    return v
      .replaceAll('ي', 'ی')
      .replaceAll('ك', 'ک')
      .replaceAll(' ', '')
      .trim()
  }

  const filtered = items.filter(item =>
    norm(item.name).includes(norm(search))
  )

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
        {filtered.map(item => (
          <div className="row" key={item.name}>
            <button className="rowButton" onClick={() => onSelect(item.name)}>
              <div>
                <strong>{item.name}</strong>
                <p>بدهی: {money(item.debt)} | پرداخت: {money(item.payment)}</p>
              </div>
              <b className={item.balance > 0 ? 'debtText' : 'payText'}>
                {money(item.balance)}
              </b>
            </button>

            <div className="actions">
              <button className="editBtn" onClick={() => renameCustomer(item.name)}>ویرایش نام</button>
              <button className="danger" onClick={() => removeCustomer(item.name)}>حذف مشتری</button>
            </div>
          </div>
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

  useEffect(() => {
    load()
  }, [name])

  async function load() {
    setLoading(true)

    const { data } = await supabase
      .from('transactions')
      .select('*')
      .eq('customer_name', name)
      .order('created_at', { ascending: false })

    setItems(data || [])
    setLoading(false)
  }

  const debt = items.filter(i => i.type === 'debt').reduce((s, i) => s + Number(i.amount), 0)
  const payment = items.filter(i => i.type === 'payment').reduce((s, i) => s + Number(i.amount), 0)
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
        description: editDescription,
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
      <button className="back small" onClick={onBack}>بازگشت به مشتری‌ها</button>

      <h2>{name}</h2>

      <div className="summary">
        <p>جمع بدهی: {money(debt)}</p>
        <p>جمع پرداخت: {money(payment)}</p>
        <h3>مانده: {money(balance)}</h3>
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
                {item.type === 'debt' ? '+' : '-'} {money(item.amount)}
              </b>

              <div className="actions">
                <button className="editBtn" onClick={() => startEdit(item)}>ویرایش</button>
                <button className="danger" onClick={() => removeTransaction(item.id)}>حذف</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}


function History({ title }: { title: string }) {
  const [filter, setFilter] = useState<'all' | 'today' | 'yesterday' | 'week' | 'month'>('today')
  const [search, setSearch] = useState('')
  const [items, setItems] = useState<Tx[]>([])

  useEffect(() => {
    load()
  }, [filter])

  function startOfDay(d: Date) {
    const x = new Date(d)
    x.setHours(0, 0, 0, 0)
    return x
  }

  async function load() {
    let query = supabase
      .from('transactions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(500)

    const now = new Date()

    if (filter === 'today') {
      query = query.gte('created_at', startOfDay(now).toISOString())
    }

    if (filter === 'yesterday') {
      const y = new Date(now)
      y.setDate(y.getDate() - 1)
      const start = startOfDay(y)
      const end = startOfDay(now)
      query = query.gte('created_at', start.toISOString()).lt('created_at', end.toISOString())
    }

    if (filter === 'week') {
      const start = new Date(now)
      start.setDate(now.getDate() - 7)
      query = query.gte('created_at', start.toISOString())
    }

    if (filter === 'month') {
      const start = new Date(now)
      start.setDate(now.getDate() - 30)
      query = query.gte('created_at', start.toISOString())
    }

    const { data } = await query
    setItems(data || [])
  }

  function norm(v: string) {
    return v
      .replaceAll('ي', 'ی')
      .replaceAll('ك', 'ک')
      .replaceAll(' ', '')
      .trim()
  }

  const filtered = items.filter(item =>
    norm(item.customer_name).includes(norm(search)) ||
    norm(item.description || '').includes(norm(search))
  )

  const debt = filtered.filter(i => i.type === 'debt').reduce((s, i) => s + Number(i.amount), 0)
  const payment = filtered.filter(i => i.type === 'payment').reduce((s, i) => s + Number(i.amount), 0)

  function exportCsv() {
    const header = ['نام مشتری', 'نوع', 'مبلغ', 'شرح', 'تاریخ']
    const rows = filtered.map(i => [
      i.customer_name,
      i.type === 'debt' ? 'بدهی' : 'پرداخت',
      String(i.amount),
      i.description || '',
      new Date(i.created_at).toLocaleString('fa-IR')
    ])

    const csv = [header, ...rows]
      .map(row => row.map(cell => `"${String(cell).replaceAll('"', '""')}"`).join(','))
      .join('\\n')

    const blob = new Blob(['\\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'saman-hesab-report.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <section className="form">
      <h2>{title}</h2>

      <div className="filterRow">
        <button className={filter === 'today' ? 'activeFilter' : ''} onClick={() => setFilter('today')}>امروز</button>
        <button className={filter === 'yesterday' ? 'activeFilter' : ''} onClick={() => setFilter('yesterday')}>دیروز</button>
        <button className={filter === 'week' ? 'activeFilter' : ''} onClick={() => setFilter('week')}>هفته</button>
        <button className={filter === 'month' ? 'activeFilter' : ''} onClick={() => setFilter('month')}>ماه</button>
        <button className={filter === 'all' ? 'activeFilter' : ''} onClick={() => setFilter('all')}>همه</button>
      </div>

      <input
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="جستجو در گزارش..."
      />

      <div className="summary">
        <p>بدهی: {money(debt)}</p>
        <p>پرداخت: {money(payment)}</p>
        <h3>مانده: {money(debt - payment)}</h3>
      </div>

      <button className="save" onClick={exportCsv}>
        خروجی Excel
      </button>

      <div className="list">
        {filtered.map(item => (
          <div className="row" key={item.id}>
            <div>
              <strong>{item.customer_name}</strong>
              <p>{item.description || (item.type === 'debt' ? 'بدهی' : 'پرداخت')}</p>
              <p>{new Date(item.created_at).toLocaleString('fa-IR')}</p>
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

export default App
