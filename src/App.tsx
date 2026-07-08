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

  return (
    <main className="app" dir="rtl">
      {page !== 'home' && <button className="back" onClick={() => setPage('home')}>بازگشت</button>}

      {page === 'home' && (
        <>
          <header>
            <h1>سامان حساب</h1>
            <p>دفتر نسیه هوشمند فروشگاه</p>
          </header>
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
      {page === 'customers' && <Customers />}
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

    if (error) {
      setMessage('خطا: ' + error.message)
    } else {
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

function Customers() {
  const [items, setItems] = useState<CustomerBalance[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    const { data, error } = await supabase
      .from('transactions')
      .select('customer_name,type,amount')

    if (error || !data) {
      setLoading(false)
      return
    }

    const map = new Map<string, CustomerBalance>()

    data.forEach((tx: any) => {
      const name = tx.customer_name
      if (!map.has(name)) {
        map.set(name, { name, debt: 0, payment: 0, balance: 0 })
      }

      const customer = map.get(name)!
      if (tx.type === 'debt') customer.debt += Number(tx.amount)
      if (tx.type === 'payment') customer.payment += Number(tx.amount)
      customer.balance = customer.debt - customer.payment
    })

    const result = Array.from(map.values()).sort((a, b) => b.balance - a.balance)
    setItems(result)
    setLoading(false)
  }

  return (
    <section className="form">
      <h2>مشتری‌ها</h2>
      {loading && <p>در حال دریافت...</p>}
      {!loading && items.length === 0 && <p>هنوز مشتری ثبت نشده.</p>}

      <div className="list">
        {items.map(item => (
          <div className="row" key={item.name}>
            <div>
              <strong>{item.name}</strong>
              <p>بدهی: {item.debt.toLocaleString('fa-IR')} | پرداخت: {item.payment.toLocaleString('fa-IR')}</p>
            </div>
            <b className={item.balance > 0 ? 'debtText' : 'payText'}>
              {item.balance.toLocaleString('fa-IR')} تومان
            </b>
          </div>
        ))}
      </div>
    </section>
  )
}

function History({ title }: { title: string }) {
  const [items, setItems] = useState<Tx[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50)

    if (!error && data) setItems(data)
    setLoading(false)
  }

  return (
    <section className="form">
      <h2>{title}</h2>
      {loading && <p>در حال دریافت...</p>}
      {!loading && items.length === 0 && <p>هنوز تراکنشی ثبت نشده.</p>}

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
