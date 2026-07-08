type Props = {
  name: string
  balance: number
  onClick: () => void
}

export default function CustomerCard({ name, balance, onClick }: Props) {
  return (
    <div className="card" onClick={onClick}>
      <h3>{name}</h3>
      <p>
        مانده:
        {' '}
        {balance.toLocaleString('fa-IR')}
      </p>
    </div>
  )
}
