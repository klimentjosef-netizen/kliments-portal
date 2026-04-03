'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import Topbar from '@/components/Topbar'

interface DocFile {
  name: string
  size: number
  created_at: string
  path: string
}

interface Folder {
  slug: string
  label: string
  files: DocFile[]
}

// Storage paths use slugs (no diacritics), display names shown in UI
const FOLDERS = [
  { slug: 'ucetni-podklady', label: 'Účetní podklady' },
  { slug: 'faktury', label: 'Faktury' },
  { slug: 'smlouvy', label: 'Smlouvy' },
  { slug: 'danove-priznani', label: 'Daňové přiznání' },
  { slug: 'ostatni', label: 'Ostatní' },
]

function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

function formatDate(d: string): string {
  return new Date(d).toLocaleDateString('cs-CZ', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function DokumentyPage() {
  const [folders, setFolders] = useState<Folder[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [activeFolder, setActiveFolder] = useState(FOLDERS[0].slug)
  const [userId, setUserId] = useState<string>('')
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_isAdmin, setIsAdmin] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [showNewFolder, setShowNewFolder] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setUserId(user.id)

      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
      if (profile?.role === 'admin') setIsAdmin(true)

      await loadFiles(user.id)
      setLoading(false)
    }
    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function loadFiles(uid: string) {
    const folderData: Folder[] = []

    for (const folder of FOLDERS) {
      const path = `${uid}/${folder.slug}`
      const { data } = await supabase.storage.from('documents').list(path, { sortBy: { column: 'created_at', order: 'desc' } })
      folderData.push({
        slug: folder.slug,
        label: folder.label,
        files: (data || []).filter(f => f.name !== '.emptyFolderPlaceholder').map(f => ({
          name: f.name,
          size: f.metadata?.size || 0,
          created_at: f.created_at || '',
          path: `${path}/${f.name}`,
        })),
      })
    }

    // Check for custom folders
    const { data: allItems } = await supabase.storage.from('documents').list(uid)
    if (allItems) {
      const knownSlugs = FOLDERS.map(f => f.slug)
      for (const item of allItems) {
        if (item.id && !knownSlugs.includes(item.name) && !item.name.includes('.')) {
          const path = `${uid}/${item.name}`
          const { data } = await supabase.storage.from('documents').list(path, { sortBy: { column: 'created_at', order: 'desc' } })
          folderData.push({
            slug: item.name,
            label: item.name,
            files: (data || []).filter(f => f.name !== '.emptyFolderPlaceholder').map(f => ({
              name: f.name,
              size: f.metadata?.size || 0,
              created_at: f.created_at || '',
              path: `${path}/${f.name}`,
            })),
          })
        }
      }
    }

    setFolders(folderData)
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (!files || files.length === 0 || !userId) return

    setUploading(true)
    for (const file of Array.from(files)) {
      const safeName = file.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9._-]/g, '_')
      const path = `${userId}/${activeFolder}/${safeName}`
      const { error } = await supabase.storage.from('documents').upload(path, file, { upsert: true })
      if (error) console.error('Upload error:', error.message)
    }
    await loadFiles(userId)
    setUploading(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function downloadFile(path: string, name: string) {
    const { data } = await supabase.storage.from('documents').download(path)
    if (data) {
      const url = URL.createObjectURL(data)
      const a = document.createElement('a')
      a.href = url
      a.download = name
      a.click()
      URL.revokeObjectURL(url)
    }
  }

  async function deleteFile(path: string) {
    if (!confirm('Smazat tento soubor?')) return
    await supabase.storage.from('documents').remove([path])
    await loadFiles(userId)
  }

  async function createFolder() {
    if (!newFolderName.trim() || !userId) return
    const slug = newFolderName.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9-]/g, '-').toLowerCase()
    const path = `${userId}/${slug}/.emptyFolderPlaceholder`
    await supabase.storage.from('documents').upload(path, new Blob(['']), { contentType: 'text/plain', upsert: true })
    await loadFiles(userId)
    setActiveFolder(slug)
    setNewFolderName('')
    setShowNewFolder(false)
  }

  const currentFolder = folders.find(f => f.slug === activeFolder)
  const totalFiles = folders.reduce((s, f) => s + f.files.length, 0)

  if (loading) return (
    <>
      <Topbar title="Dokumenty" />
      <div className="p-4 lg:p-9"><div className="animate-pulse h-40 bg-white rounded-[20px]" /></div>
    </>
  )

  return (
    <>
      <Topbar title="Dokumenty" />
      <div className="p-4 lg:p-9">
        {/* Header */}
        <div className="bg-ink rounded-[20px] p-7 mb-6 relative overflow-hidden">
          <div className="absolute right-[-10px] bottom-[-40px] font-serif italic text-[180px] text-white/[0.04] leading-none pointer-events-none">📁</div>
          <h2 className="font-serif text-xl text-sand font-light mb-1.5">Dokumenty</h2>
          <p className="text-[0.78rem] text-white/40">
            {totalFiles} {totalFiles === 1 ? 'soubor' : totalFiles < 5 ? 'soubory' : 'souborů'} v {folders.length} složkách
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[250px_1fr] gap-6">
          {/* Folder list */}
          <div className="bg-white rounded-[20px] p-4 border border-black/[0.06]">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-[0.62rem] tracking-[0.12em] uppercase text-mid font-medium">Složky</h3>
              <button onClick={() => setShowNewFolder(!showNewFolder)} className="text-[0.62rem] text-mid hover:text-rose">+ Nová</button>
            </div>

            {showNewFolder && (
              <div className="flex gap-2 mb-3">
                <input value={newFolderName} onChange={e => setNewFolderName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && createFolder()}
                  placeholder="Název složky"
                  className="flex-1 bg-transparent border-b border-black/10 py-1 text-sm outline-none focus:border-rose" />
                <button onClick={createFolder} className="text-[0.62rem] text-rose hover:text-rose-deep">Vytvořit</button>
              </div>
            )}

            <div className="space-y-1">
              {folders.map(f => (
                <button key={f.slug} onClick={() => setActiveFolder(f.slug)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-[0.8rem] transition-colors flex justify-between items-center ${
                    activeFolder === f.slug ? 'bg-rose/10 text-rose-deep font-medium' : 'text-mid hover:bg-sand hover:text-ink'
                  }`}>
                  <span className="truncate">📁 {f.label}</span>
                  <span className="text-[0.65rem] text-mid">{f.files.length}</span>
                </button>
              ))}
            </div>
          </div>

          {/* File list */}
          <div className="bg-white rounded-[20px] p-6 border border-black/[0.06]">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-serif text-base text-ink">{currentFolder?.label || activeFolder}</h3>
              <div className="flex gap-2">
                <input ref={fileInputRef} type="file" multiple onChange={handleUpload} className="hidden" />
                <button onClick={() => fileInputRef.current?.click()} disabled={uploading}
                  className="bg-rose text-white px-5 py-2 rounded-full text-[0.72rem] tracking-[0.1em] uppercase font-medium hover:bg-rose-deep transition-colors disabled:opacity-50">
                  {uploading ? 'Nahrávám...' : '+ Nahrát soubor'}
                </button>
              </div>
            </div>

            {!currentFolder || currentFolder.files.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-4xl mb-3">📂</div>
                <p className="text-[0.85rem] text-mid mb-1">Složka je prázdná</p>
                <p className="text-[0.72rem] text-mid">Nahrajte první soubor tlačítkem výše</p>
              </div>
            ) : (
              <div className="space-y-2">
                {currentFolder.files.map((file, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-sand-pale border border-black/[0.04] hover:border-rose/20 transition-colors">
                    <div className="w-9 h-9 rounded-lg bg-rose/10 flex items-center justify-center text-sm flex-shrink-0">
                      {file.name.match(/\.(pdf)$/i) ? '📄' :
                       file.name.match(/\.(xlsx?|csv)$/i) ? '📊' :
                       file.name.match(/\.(docx?|txt)$/i) ? '📝' :
                       file.name.match(/\.(png|jpg|jpeg|gif)$/i) ? '🖼️' :
                       '📎'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[0.82rem] font-medium text-ink truncate">{file.name}</div>
                      <div className="text-[0.65rem] text-mid">
                        {formatSize(file.size)} {file.created_at ? `· ${formatDate(file.created_at)}` : ''}
                      </div>
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      <button onClick={() => downloadFile(file.path, file.name)}
                        className="text-[0.68rem] text-rose hover:text-rose-deep">Stáhnout</button>
                      <button onClick={() => deleteFile(file.path)}
                        className="text-[0.68rem] text-mid hover:text-rose-deep">Smazat</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
