'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Film, Loader2, Trash2 } from 'lucide-react'
import { deleteVideo } from '@/app/actions/admin'

/** Video prohlídky (MP4) nahrané přímo na web. Nahrává se s průběhem (XHR — fetch průběh odesílání neumí). */
export function VideoManager({ listingId, videoPath }: { listingId: string; videoPath: string | null }) {
  const router = useRouter()
  const [progress, setProgress] = useState<number | null>(null)
  const [error, setError] = useState('')
  const input = useRef<HTMLInputElement>(null)

  function upload(file: File) {
    if (file.type && file.type !== 'video/mp4') return setError('Nahrajte prosím video ve formátu MP4.')
    if (file.size > 600 * 1024 * 1024) return setError('Video je větší než 600 MB. Zkuste ho zmenšit, nebo dejte odkaz na YouTube.')
    setError('')
    setProgress(0)
    const xhr = new XMLHttpRequest()
    xhr.open('POST', `/api/admin/upload?kind=video&listingId=${listingId}`)
    xhr.setRequestHeader('Content-Type', 'video/mp4')
    xhr.upload.onprogress = (e) => e.lengthComputable && setProgress(Math.round((e.loaded / e.total) * 100))
    xhr.onload = () => {
      setProgress(null)
      if (xhr.status >= 200 && xhr.status < 300) router.refresh()
      else {
        try {
          setError(JSON.parse(xhr.responseText).error)
        } catch {
          setError('Nahrání se nepovedlo.')
        }
      }
    }
    xhr.onerror = () => {
      setProgress(null)
      setError('Spojení se přerušilo. Zkuste to znovu.')
    }
    xhr.send(file)
  }

  return (
    <div className="mt-4">
      {videoPath && progress == null && (
        <div className="mb-4">
          <video controls preload="metadata" className="max-h-72 w-full max-w-xl bg-ink" src={`/media/${videoPath}`} />
          <button
            type="button"
            onClick={async () => {
              if (!confirm('Smazat video?')) return
              await deleteVideo(listingId)
              router.refresh()
            }}
            className="mt-2 inline-flex items-center gap-1.5 text-sm text-red-700 hover:underline"
          >
            <Trash2 className="h-4 w-4" aria-hidden /> Smazat video
          </button>
        </div>
      )}
      {progress != null ? (
        <div className="max-w-xl">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Nahrávám video… {progress} %
          </p>
          <div className="mt-2 h-2 bg-paper-2">
            <div className="h-full bg-gold transition-[width]" style={{ width: `${progress}%` }} />
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => input.current?.click()} className="btn-ghost-dark min-h-[2.6rem]">
          <Film className="h-4 w-4" aria-hidden /> {videoPath ? 'Nahrát jiné video' : 'Nahrát video (MP4)'}
        </button>
      )}
      <input ref={input} type="file" accept="video/mp4" hidden onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
      {error && <p className="mt-3 border-l-2 border-red-500 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
    </div>
  )
}
