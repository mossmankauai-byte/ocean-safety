// The element picker for /review. The review shell injects this into the page
// it is previewing. It only reads the page and posts what was clicked to the
// shell. It changes nothing.
(() => {
  if (window.__osEditorInspector) return
  window.__osEditorInspector = true

  // Live bytes only. The app registers a service worker; in edit mode it would
  // happily serve a stale build back at us.
  if (navigator.serviceWorker) {
    navigator.serviceWorker.getRegistrations().then(rs => rs.forEach(r => r.unregister())).catch(() => {})
  }

  const style = document.createElement('style')
  style.textContent = `
    .osed-hover { outline: 2px dashed #16a4c8 !important; outline-offset: 1px !important; cursor: crosshair !important; }
    .osed-picked { outline: 2px solid #0b6e8f !important; outline-offset: 1px !important; box-shadow: 0 0 0 4px rgba(22,164,200,.22) !important; }
    #osed-label {
      position: fixed; z-index: 2147483647; pointer-events: none;
      background: #0b2a36; color: #e8f6fb; font: 600 11px/1.4 ui-monospace, Menlo, monospace;
      padding: 3px 7px; border-radius: 4px; box-shadow: 0 2px 8px rgba(0,0,0,.35);
      max-width: 60vw; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }`
  document.documentElement.appendChild(style)

  const label = document.createElement('div')
  label.id = 'osed-label'
  label.style.display = 'none'
  document.documentElement.appendChild(label)

  let active = false
  let hovered = null
  let picked = null

  const describe = el => {
    let s = el.tagName.toLowerCase()
    if (el.id) s += '#' + el.id
    else if (el.className && typeof el.className === 'string') {
      const c = el.className.trim().split(/\s+/).filter(x => !x.startsWith('osed-')).slice(0, 2)
      if (c.length) s += '.' + c.join('.')
    }
    return s
  }

  // Selector stable enough to re-find the element, short enough to read.
  const selectorFor = el => {
    const parts = []
    let node = el
    while (node && node.nodeType === 1 && parts.length < 5) {
      if (node.id) { parts.unshift('#' + node.id); break }
      let part = node.tagName.toLowerCase()
      const parent = node.parentElement
      if (parent) {
        const sibs = [...parent.children].filter(c => c.tagName === node.tagName)
        if (sibs.length > 1) part += `:nth-of-type(${sibs.indexOf(node) + 1})`
      }
      parts.unshift(part)
      node = parent
    }
    return parts.join(' > ')
  }

  const clear = el => el && el.classList.remove('osed-hover')

  const onMove = e => {
    if (!active) return
    const el = e.target
    if (el === hovered || el === label) return
    clear(hovered)
    hovered = el
    el.classList.add('osed-hover')
    label.textContent = describe(el)
    label.style.display = 'block'
    const r = el.getBoundingClientRect()
    label.style.left = Math.max(4, r.left) + 'px'
    label.style.top = (r.top > 22 ? r.top - 20 : r.bottom + 4) + 'px'
  }

  // Ancestor chain, element first, so the panel can offer "you clicked the icon,
  // did you mean the card?" without another round of clicking.
  const chainFor = el => {
    const chain = []
    let n = el
    while (n && n.nodeType === 1 && n !== document.documentElement && chain.length < 8) {
      chain.push(describe(n))
      n = n.parentElement
    }
    return chain
  }

  function report(el) {
    if (picked) picked.classList.remove('osed-picked')
    picked = el
    el.classList.add('osed-picked')
    el.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    parent.postMessage({
      source: 'osed',
      kind: 'pick',
      page: location.pathname,
      selector: selectorFor(el),
      elementId: el.id || (el.closest('[id]') ? el.closest('[id]').id : ''),
      label: describe(el),
      snippet: el.outerHTML.slice(0, 1200),
      chain: chainFor(el),
    }, '*')
  }

  const onClick = e => {
    if (!active) return
    e.preventDefault()
    e.stopPropagation()
    clear(hovered); hovered = null
    label.style.display = 'none'
    setActive(false)
    report(e.target)
  }

  const onKey = e => {
    if (e.key === 'Escape') {
      setActive(false)
      if (picked) { picked.classList.remove('osed-picked'); picked = null }
      parent.postMessage({ source: 'osed', kind: 'clear' }, '*')
    }
  }

  function setActive(on) {
    active = on
    if (!on) { clear(hovered); hovered = null; label.style.display = 'none' }
    document.documentElement.style.cursor = on ? 'crosshair' : ''
    parent.postMessage({ source: 'osed', kind: 'mode', active: on }, '*')
  }

  document.addEventListener('mousemove', onMove, true)
  document.addEventListener('click', onClick, true)
  document.addEventListener('keydown', onKey, true)

  window.addEventListener('message', e => {
    const m = e.data
    if (!m || m.source !== 'osed-shell') return
    if (m.kind === 'setActive') setActive(!!m.active)
    // Walk up the chain from the panel's crumbs.
    if (m.kind === 'climb' && picked) {
      let n = picked
      for (let i = 0; i < m.steps && n.parentElement; i++) n = n.parentElement
      report(n)
    }
  })

  parent.postMessage({ source: 'osed', kind: 'ready' }, '*')
})()
