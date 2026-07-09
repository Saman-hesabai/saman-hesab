import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [storeName, setStoreName] = useState('')
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')

  async function loadUserStore(userEmail: string) {
    let { data } = await supabase
      .from('store_users')
      .select('store_id')
      .eq('user_email', userEmail)
      .limit(1)
      .single()

    if (data?.store_id) {
      localStorage.setItem('store_id', data.store_id)
      return data.store_id
    }

    const { data: store } = await supabase
      .from('stores')
      .insert({
        name: storeName.trim() || 'فروشگاه من',
        owner_email: userEmail
      })
      .select()
      .single()

    if (!store?.id) {
      localStorage.removeItem('store_id')
      return ''
    }

    await supabase.from('store_users').insert({
      store_id: store.id,
      user_email: userEmail,
      role: 'owner'
    })

    localStorage.setItem('store_id', store.id)
    return store.id
  }

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (data.user?.email) await loadUserStore(data.user.email)
      setUser(data.user)
      setLoading(false)
    })

    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user?.email) await loadUserStore(session.user.email)
      setUser(session?.user || null)
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  async function signIn() {
    setMessage('در حال ورود...')
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setMessage('ایمیل یا رمز عبور اشتباه است.')
      return
    }

    if (data.user?.email) await loadUserStore(data.user.email)
    setUser(data.user)
    setMessage('')
  }

  async function signUp() {
    setMessage('در حال ساخت حساب فروشگاه...')

    const { data, error } = await supabase.auth.signUp({ email, password })

    if (error) {
      setMessage(error.message)
      return
    }

    const name = storeName.trim() || 'فروشگاه من'

    const { data: store, error: storeError } = await supabase
      .from('stores')
      .insert({ name, owner_email: email })
      .select()
      .single()

    if (storeError || !store) {
      setMessage('حساب ساخته شد، اما فروشگاه ثبت نشد.')
      return
    }

    await supabase.from('store_users').insert({
      store_id: store.id,
      user_email: email,
      role: 'owner'
    })

    localStorage.setItem('store_id', store.id)
    setUser(data.user)
    setMessage('حساب فروشگاه ساخته شد ✅')
  }

  async function resetPassword() {
    if (!email.trim()) {
      setMessage('اول ایمیل را وارد کن.')
      return
    }

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: 'https://saman-hesabai.github.io/saman-hesab/'
    })

    if (error) setMessage(error.message)
    else setMessage('لینک بازیابی رمز به ایمیل شما ارسال شد ✅')
  }

  async function logout() {
    await supabase.auth.signOut()
    localStorage.removeItem('store_id')
    setUser(null)
  }

  if (loading) return <main className="app" dir="rtl">در حال بارگذاری...</main>

  if (!user) {
    return (
      <main className="app" dir="rtl">
        <section className="form">
          <h1>سامان حساب</h1>
          <p>ورود یا ساخت حساب فروشگاه</p>

          <input value={storeName} onChange={e => setStoreName(e.target.value)} placeholder="نام فروشگاه برای ثبت‌نام" />
          <input value={email} onChange={e => setEmail(e.target.value)} placeholder="ایمیل" type="email" />
          <input value={password} onChange={e => setPassword(e.target.value)} placeholder="رمز عبور" type="password" />

          <button className="save" onClick={signIn}>ورود</button>
          <button className="editBtn" onClick={signUp}>ثبت‌نام فروشگاه</button>
          <button className="back small" onClick={resetPassword}>فراموشی رمز عبور</button>

          {message && <p>{message}</p>}
        </section>
      </main>
    )
  }

  return (
    <>
      <div className="topUserBar" dir="rtl">
        <span>{user.email}</span>
        <button onClick={logout}>خروج</button>
      </div>
      {children}
    </>
  )
}
