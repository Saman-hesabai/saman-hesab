import { supabase } from '../lib/supabase'
import type { Tx } from '../types'

export async function saveTransaction(customerName: string, type: 'debt' | 'payment', amount: number, description: string) {
  const cleanName = customerName.trim()

  const { data: customer } = await supabase
    .from('customers')
    .upsert({ name: cleanName }, { onConflict: 'name' })
    .select()
    .single()

  if (!customer) throw new Error('خطا در ثبت مشتری')

  const { error } = await supabase.from('transactions').insert({
    customer_id: customer.id,
    customer_name: cleanName,
    type,
    amount,
    description
  })

  if (error) throw error
}

export async function getTransactions(limit = 50): Promise<Tx[]> {
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw error
  return data || []
}

export async function deleteTransaction(id: string) {
  const { error } = await supabase.from('transactions').delete().eq('id', id)
  if (error) throw error
}

export async function renameCustomer(oldName: string, newName: string) {
  const cleanNewName = newName.trim()

  const { data: customer } = await supabase
    .from('customers')
    .select('id')
    .eq('name', oldName)
    .single()

  if (customer?.id) {
    await supabase.from('customers').update({ name: cleanNewName }).eq('id', customer.id)
    await supabase.from('transactions').update({ customer_name: cleanNewName }).eq('customer_id', customer.id)
  } else {
    await supabase.from('transactions').update({ customer_name: cleanNewName }).eq('customer_name', oldName)
  }
}

export async function deleteCustomer(name: string) {
  const { data: customer } = await supabase
    .from('customers')
    .select('id')
    .eq('name', name)
    .single()

  if (customer?.id) {
    await supabase.from('customers').delete().eq('id', customer.id)
  } else {
    await supabase.from('transactions').delete().eq('customer_name', name)
  }
}
