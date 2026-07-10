import { useEffect, useState, type ReactNode } from 'react'
import { supabase } from '../lib/supabase'

const APP_URL = 'https://saman-hesabai.github.io/saman-hesab/'

type AuthGateProps = { children: ReactNode }

type AuthMode = 'login' | 'recovery'

export default function AuthGate({ children }: AuthGateProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [storeName, setStoreName] = useState('')
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [storeReady, setStoreReady] = useState(false)
  const [mode, setMode] = useState<AuthMode>('login')
  const [message, setMessage] = useState('')

  async function resolveUserStore(userEmail: string) {
    setStoreReady(false)

    const { data: membership, error: membershipError } = await supabase
      .from('store_users')
      .select('store_id')
      .eq('user_email', userEmail)
      .limit(1)
      .maybeSingle()

    if (!membershipError && membership?.store_id) {
      localStorage.setItem('store_id', membership.store_id)
      setStoreReady(true)
      return membership.store_id as string
    }

    const { data: ownedStore } = await supabase
      .from('stores')
      .select('id')
      .eq('owner_email', userEmail)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()

    if (ownedStore?.id) {
      await supabase.from('store_users').insert({
        store_id: ownedStore.id,
        user_email: userEmail,
        role: 'owner'
      })
      localStorage.setItem('store_id', ownedStore.id)
      setStoreReady(true)
      return ownedStore.id as string
    }

    const { data: createdStore, error: createError } = await supabase
      .from('stores')
      .insert({ name: storeName.trim() || 'فروشگاه من', owner_email: userEmail })
      .select('id')
      .single()

    if (createError || !createdStore?.id) {
      localStorage.removeItem('store_id')
      setMessage('فروشگاه حساب شما پیدا نشد. دوباره تلاش کنید.')
      return ''
    }

    const { error: memberError } = await supabase.from('store_users').insert({
      store_id: createdStore.id,
      user_email: userEmail,
      role: 'owner'
    })

    if (memberError) {
      localStorage.removeItem('store_id')
      setMessage('فروشگاه ساخته شد اما اتصال کاربر کامل نشد.')
      return ''
    }

    localStorage.setItem('store_id', createdStore.id)
    setStoreReady(true)
    return createdStore.id as string
  }

  useEffect(() => {
    let mounted = true

    supabase.auth.getSession().then(async ({ data }) => {
      const sessionUser = data.session?.user || null
      if (sessionUser?.email) await resolveUserStore(sessionUser.email)
      if (mounted) {
        setUser(sessionUser)
        setLoading(false)
      }
    })

    const { data: listener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setMode('recovery')
        setUser(session?.user || null)
        setLoading(false)
        return
      }

      const sessionUser = session?.user || null
      if (sessionUser?.email) await resolveUserStore(sessionUser.email)
      else {
        localStorage.removeItem('store_id')
        setStoreReady(false)
      }
      if (mounted) {
        setUser(sessionUser)
        setLoading(false)
      }
    })

    return () => {
      mounted = false
      listener.subscription.unsubscribe()
    }
  }, [])

  async function signIn() {
    if (!email.trim() || !password) {
      setMessage('ایمیل و رمز عبور را وارد کنید.')
      return
    }

    setMessage('در حال ورود...')
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password
    })

    if (error || !data.user) {
      setMessage('ایمیل یا رمز عبور اشتباه است.')
      return
    }

    if (data.user.email) await resolveUserStore(data.user.email)
    setUser(data.user)
    setMessage('')
  }

  async function signUp() {
    if (!storeName.trim() || !email.trim() || password.length < 6) {
      setMessage('نام فروشگاه، ایمیل و رمز حداقل ۶ کاراکتری را وارد کنید.')
      return
    }

    setMessage('در حال ساخت حساب فروشگاه...')
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        emailRedirectTo: APP_URL,
        data: { store_name: storeName.trim() }
      }
    })

    if (error) {
      setMessage(error.message)
      return
    }

    if (data.session && data.user?.email) {
      await resolveUserStore(data.user.email)
      setUser(data.user)
      setMessage('حساب فروشگاه ساخته شد ✅')
    } else {
      setMessage('حساب ساخته شد. ایمیل تأیید را باز کنید و سپس وارد شوید ✅')
    }
  }

  async function requestPasswordReset() {
    if (!email.trim()) {
      setMessage('اول ایمیل حساب را وارد کنید.')
      return
    }

    setMessage('در حال ارسال لینک بازیابی...')
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${APP_URL}?password-recovery=1`
    })

    setMessage(error ? error.message : 'لینک بازیابی رمز به ایمیل شما ارسال شد ✅')
  }

  async function saveNewPassword() {
    if (newPassword.length < 6) {
      setMessage('رمز جدید باید حداقل ۶ کاراکتر باشد.')
      return
    }

    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) {
      setMessage(error.message)
      return
    }

    setMessage('رمز جدید با موفقیت ثبت شد ✅')
    setNewPassword('')
    setMode('login')
    window.history.replaceState({}, document.title, APP_URL)
  }

  async function logout() {
    await supabase.auth.signOut()
    localStorage.removeItem('store_id')
    setUser(null)
    setStoreReady(false)
    setMode('login')
  }

  if (loading) return <main className="app" dir="rtl">در حال بارگذاری...</main>

  if (mode === 'recovery') {
    return (
      <main className="app" dir="rtl">
        <section className="form authCard">
          <h1>تنظیم رمز جدید</h1>
          <input
            value={newPassword}
            onChange={e => setNewPassword(e.target.value)}
            placeholder="رمز جدید؛ حداقل ۶ کاراکتر"
            type="password"
          />
          <button className="save" onClick={saveNewPassword}>ذخیره رمز جدید</button>
          {message && <p>{message}</p>}
        </section>
      </main>
    )
  }

  if (!user) {
    return (
      <main className="app" dir="rtl">
        <section className="form authCard">
          <h1>سامان حساب</h1>
          <p>ورود یا ساخت حساب اختصاصی فروشگاه</p>

          <input value={storeName} onChange={e => setStoreName(e.target.value)} placeholder="نام فروشگاه؛ فقط برای ثبت‌نام" />
          <input value={email} onChange={e => setEmail(e.target.value)} placeholder="ایمیل" type="email" autoComplete="email" />
          <input value={password} onChange={e => setPassword(e.target.value)} placeholder="رمز عبور" type="password" autoComplete="current-password" />

          <button className="save" onClick={signIn}>ورود</button>
          <button className="editBtn" onClick={signUp}>ثبت‌نام فروشگاه</button>
          <button className="textButton" onClick={requestPasswordReset}>فراموشی رمز عبور</button>

          {message && <p className="authMessage">{message}</p>}
        </section>
      </main>
    )
  }

  if (!storeReady) {
    return (
      <main className="app" dir="rtl">
        <section className="form authCard">
          <h2>در حال اتصال فروشگاه...</h2>
          <p>{message || 'چند لحظه صبر کنید.'}</p>
          <button className="save" onClick={() => user.email && resolveUserStore(user.email)}>تلاش دوباره</button>
          <button className="danger" onClick={logout}>خروج</button>
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
