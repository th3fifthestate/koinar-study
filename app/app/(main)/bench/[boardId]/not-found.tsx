import Link from 'next/link'

export default function BoardNotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4 text-center px-8">
      <h1 className="text-2xl font-bold text-foreground">Board not found</h1>
      <p className="text-muted-foreground text-sm max-w-xs">
        This board doesn&apos;t exist or you don&apos;t have access to it.
      </p>
      <Link
        href="/bench"
        className="text-sage-600 hover:text-sage-800 hover:underline text-sm transition-colors"
      >
        ← Back to boards
      </Link>
    </div>
  )
}
