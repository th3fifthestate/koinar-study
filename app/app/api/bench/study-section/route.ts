import { requireAdmin } from '@/lib/auth/middleware'
import { createRateLimiter, getClientIp } from '@/lib/rate-limit'
import { getStudyById } from '@/lib/db/queries'
import { extractSection, slugify } from '@/lib/bench/extract-study-section'

const isRateLimited = createRateLimiter({ windowMs: 60_000, max: 120 })

export async function GET(request: Request) {
  const { response } = await requireAdmin()
  if (response) return response

  const ip = getClientIp(request)
  if (isRateLimited(ip)) {
    return Response.json({ error: 'Too many requests' }, { status: 429 })
  }

  const url = new URL(request.url)
  const studyIdParam = url.searchParams.get('study_id')
  const headingSlug = url.searchParams.get('heading_slug')

  const studyId = parseInt(studyIdParam ?? '', 10)
  if (isNaN(studyId) || studyId <= 0 || !headingSlug) {
    return Response.json(
      { error: 'Missing required params: study_id, heading_slug' },
      { status: 400 }
    )
  }

  if (headingSlug.length > 200) {
    return Response.json({ error: 'heading_slug too long' }, { status: 400 })
  }

  const study = getStudyById(studyId)
  if (!study?.content_markdown) {
    return Response.json({ content: null, heading: null, study_slug: null })
  }

  const content = extractSection(study.content_markdown, headingSlug)

  // Find the actual heading text that matches the slug for display
  const headingLine = study.content_markdown
    .split('\n')
    .find(l => {
      const m = l.match(/^#{2,3}\s+(.+)$/)
      return m && slugify(m[1]) === headingSlug
    })
  const headingText = headingLine?.replace(/^#{2,3}\s+/, '') ?? headingSlug

  return Response.json({ content, heading: headingText, study_slug: study.slug })
}
