export default function LoadingChart({ height = 300 }: { height?: number }) {
  return (
    <div
      className="w-full bg-surface-700/50 rounded-xl animate-pulse"
      style={{ height }}
    />
  )
}
