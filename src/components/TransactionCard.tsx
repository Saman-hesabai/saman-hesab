import type { Tx } from '../types'

type Props = {
  item: Tx
  onDelete?: () => void
}

export default function TransactionCard({ item, onDelete }: Props) {
  return (
    <div className="row">
      <div>
        <strong>{item.customer_name}</strong>
        <p>{item.description || (item.type === 'debt' ? 'بدهی' : 'پرداخت')}</p>
      </div>

      <div>
        <b className={item.type === 'debt' ? 'debtText' : 'payText'}>
          {item.type === 'debt' ? '+' : '-'} {item.amount.toLocaleString('fa-IR')} تومان
        </b>

        {onDelete && (
          <button className="danger" onClick={onDelete}>
            حذف
          </button>
        )}
      </div>
    </div>
  )
}
