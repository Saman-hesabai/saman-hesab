export type Page = 'home' | 'debt' | 'payment' | 'customers' | 'today'

export type Tx = {
  id: string
  customer_name: string
  type: 'debt' | 'payment'
  amount: number
  description: string | null
  created_at: string
}

export type CustomerBalance = {
  name: string
  debt: number
  payment: number
  balance: number
}
