# __worker__ 
$worker = new Worker('__worker__', name: 'wallpaper')
$palette = null
$maxWidth = 150

sendMessage = (opts, buffers) ->
  opts.promiseId = nanoid(16)
  new Promise((resolve, reject) ->
    listener = (e) ->
      if e.data.promiseId == opts.promiseId
        if /2\d\d/.test(String(e.data.status))
          resolve(e.data)
        else
          reject(e.data)
        $worker.removeEventListener('message', listener)
    $worker.addEventListener('message', listener)
    $worker.postMessage(opts, buffers)
  )

fileDropHandler = (e) ->
  if e.dataTransfer.files?.length > 0
    e.stopPropagation()
    e.preventDefault()
    files = Array::slice.call(e.dataTransfer.files)
    container = document.getElementById('gallery')
    files.forEach((file) ->
      image = new Image()
      image.setAttribute('width', $maxWidth)
      image.setAttribute('height', $maxWidth)
      container.appendChild(image)
      new Response(file).arrayBuffer().then((buffer) ->
        sendMessage(cmd: 'saveFile', file: buffer, type: file.type, [buffer]).then((response) ->
          image.onload = ->
            this.setAttribute('height', this.naturalHeight / 2)
          image.src = response.url
        )
      )
    )

emptyElement = (element) ->
  while element.firstChild
    element.removeChild(element.firstChild)

loadIcons = ->
  sendMessage(cmd: 'loadIcons').then((e) ->
    for position, url of e.icons
      position = Number(position)
      row = Math.ceil(position / 4)
      col = position % 4
      if col == 0
        col = 4
      g = document.querySelector("#iphone svg g#row-#{row} > g:nth-child(#{col})")
      placeholder = g.querySelector('rect.icon')
      placeholder?.removeEventListener('drop', iconImageDrop)
      emptyElement(g)
      img = createSVGElement('image')
      img.setAttributeNS('http://www.w3.org/1999/xlink', 'href', url)
      img.setAttribute('x', '-60')
      img.setAttribute('y', '-60')
      img.setAttribute('width', '120')
      img.setAttribute('height', '120')
      img.setAttribute('clip-path', 'url(#icon)')
      g.appendChild(img)
  )

loadImages = ->
  container = document.getElementById('gallery')
  emptyElement(container)
  sendMessage(cmd: 'loadImages').then((e) ->
    keys = Object.keys(e.images).map((n) -> Number(n)).sort((a,b) ->
      a - b
    )
    for key in keys
      url = e.images[key]
      image = new Image()
      image.setAttribute('width', $maxWidth)
      image.setAttribute('data-id', key)
      image.onload = ->
        this.setAttribute('height', this.naturalHeight / 2)
        this.setAttribute('draggable', 'true')
      image.src = url
      container.appendChild(image)
      image.addEventListener('dragstart', iconImageDragStart)
      image
  )

iconImageDragStart = (e) ->
  e.dataTransfer.setData('application/json', JSON.stringify({
    id: this.getAttribute('data-id')
  }))
  for el in document.querySelectorAll('.icon')
    el.addEventListener('dragover', (e) ->
      e.preventDefault()
      this.classList.add('over')
    )
    el.addEventListener('dragleave', (e) ->
      e.preventDefault()
      this.classList.remove('over')
    )

iconImageDrop = (e) ->
  position = this.getAttribute('data-position')
  this.classList.remove('over')
  image = JSON.parse(e.dataTransfer.getData('application/json'))
  sendMessage(cmd: 'getImage', id: image.id).then((response) ->
    positionImage(response.image, position)
  )

positionImage = (image, position) ->
  div = document.createElement('div')
  div.classList.add('modal')
  svg = createSVGElement('svg')
  svg.setAttribute('width', window.innerWidth)
  svg.setAttribute('height', window.innerHeight)
  svg.setAttribute('viewBox', "0 0 #{window.innerWidth} #{window.innerHeight}")
  div.appendChild(svg)
  img = createSVGElement('image')
  img.setAttributeNS('http://www.w3.org/1999/xlink', 'href', image.src)
  m = svg.createSVGMatrix().scale(2)
  t = svg.createSVGTransformFromMatrix(m)
  img.transform.baseVal.appendItem(t)
  svg.appendChild(img)
  polygon = document.querySelector('#iphone defs polygon').cloneNode()
  polygon.classList.add('frame')
  x = (innerWidth / 4)
  y = (innerHeight / 4)
  # TODO: window resizes will wreak havoc with this
  polygon.setAttribute('transform', "scale(2) translate(#{x},#{y})")
  svg.appendChild(polygon)
  document.body.appendChild(div)
  img.addEventListener('pointerdown', initTranslation)
  img.addEventListener('mousewheel', initScale)
  bar = document.createElement('div')
  bar.classList.add('button-bar')
  cancelButton = document.createElement('button')
  cancelButton.setAttribute('type', 'button')
  cancelButton.textContent = 'Cancel'
  bar.appendChild(cancelButton)
  submitButton = document.createElement('button')
  submitButton.setAttribute('type', 'button')
  submitButton.textContent = 'Set'
  bar.appendChild(submitButton)
  div.appendChild(bar)
  cancelButton.addEventListener('click', (e) ->
    emptyElement(div)
    document.body.removeChild(div)
  )
  submitButton.addEventListener('click', (e) ->
    img.removeEventListener('pointerdown', initTranslation)
    ctm = img.getCTM()
    # position relative to icon target
    scale = ctm.a / 2
    dx = (ctm.e / 2) - x + 60
    dy = (ctm.f / 2) - y + 60
    sendMessage({cmd: 'generateIcon', id: image.id, scale, dx, dy, position}).then( ->
      emptyElement(div)
      document.body.removeChild(div)
      loadIcons()
    )
  )

initScale = (e) ->
  svg = this.parentNode
  e.preventDefault()
  e.stopPropagation()
  ctm = this.getCTM()
  scale = 1 + ((e.wheelDelta || -e.detail) / 300)
  scale = Math.max(0.1, Math.min(2, scale))
  newScale = ctm.a * scale
  if (newScale > .1) && (newScale < 2)
    t = svg.createSVGTransformFromMatrix(
      ctm.scale(scale)
    )
    this.transform.baseVal.clear()
    this.transform.baseVal.appendItem(t)

initTranslation = (e) ->
  image = this
  svg = image.parentNode
  ctm = image.getCTM()
  startPoint = svg.createSVGPoint()
  startPoint.x = e.clientX
  startPoint.y = e.clientY
  inverseMatrix = ctm.inverse()
  startPoint = startPoint.matrixTransform(inverseMatrix)
  pointermove = (e) ->
    currentPoint = svg.createSVGPoint()
    currentPoint.x = e.clientX
    currentPoint.y = e.clientY
    currentPoint = currentPoint.matrixTransform(inverseMatrix)
    deltaX = currentPoint.x - startPoint.x
    deltaY = currentPoint.y - startPoint.y
    t = svg.createSVGTransformFromMatrix(
      ctm.translate(deltaX, deltaY)
    )
    image.transform.baseVal.clear()
    image.transform.baseVal.appendItem(t)
  pointerup = (e) ->
    window.removeEventListener('pointermove', pointermove)
    window.removeEventListener('pointerup', pointerup)
  window.addEventListener('pointermove', pointermove)
  window.addEventListener('pointerup', pointerup)

setBackground = (e) ->
  $palette.style.backgroundColor = this.value
  try
    localStorage?.setItem('background-color', this.value)
  catch e
    null

iphone = {
  width: 640
  height: 1136
  iconSize: 120
  xOffset: 92
  xGap: 32
  yOffset: 114
  yGap: 31
  rows: 5
}

createSVGElement = (tagName) ->
  document.createElementNS('http://www.w3.org/2000/svg', tagName)

generateIphone = ->
  sendMessage(cmd: 'getSquircle').then((response) ->
    points = response.points
    svg = createSVGElement('svg')
    svg.setAttribute('width', iphone.width / 2)
    svg.setAttribute('height', iphone.height / 2)
    svg.setAttribute('viewBox', "0 0 #{iphone.width} #{iphone.height}")
    defs = createSVGElement('defs')
    svg.appendChild(defs)
    clipPath = createSVGElement('clipPath')
    defs.appendChild(clipPath)
    clipPath.setAttribute('id', 'icon')
    clipPath.appendChild(iconClipPolygon(points))
    q = 176
    position = 0
    [1..iphone.rows].forEach((row) ->
      g = createSVGElement('g')
      g.id = "row-#{row}"
      g.setAttribute('transform', "translate(0, #{(row-1)*q})")
      for i in [1..4]
        position++
        icon = createSVGElement('g')
        xOffset = iphone.xOffset + ((iphone.iconSize + iphone.xGap) * (i-1))
        icon.setAttribute('transform', "translate(#{xOffset}, 114)")
        placeholder = createSVGElement('rect')
        placeholder.classList.add('icon')
        placeholder.setAttribute('x', -60)
        placeholder.setAttribute('y', -60)
        placeholder.setAttribute('width', 120)
        placeholder.setAttribute('height', 120)
        placeholder.setAttribute('clip-path', 'url(#icon)')
        placeholder.setAttribute('data-position', position)
        icon.appendChild(placeholder)
        placeholder.addEventListener('drop', iconImageDrop)
        g.appendChild(icon)
      svg.appendChild(g)
    )
    document.getElementById('iphone').appendChild(svg)
  )

iconClipPolygon = (points) ->
  polygon = createSVGElement('polygon')
  polygon.setAttribute('points', points.join(' '))
  return polygon

document.addEventListener('DOMContentLoaded', ->
  opened = sendMessage(cmd: 'open').then(loadImages)
  $palette = document.getElementById('palette')
  # store background 
  backgroundColorPicker = document.getElementById('background-color')
  backgroundColorPicker.addEventListener('change', setBackground)
  try
    initBackgroundColor = localStorage?.getItem('background-color')
    if initBackgroundColor?
      backgroundColorPicker.value = initBackgroundColor
      setBackground.call(backgroundColorPicker)
  catch e
    null
  document.addEventListener('drop', fileDropHandler)
  document.addEventListener('dragover', (e) ->
    e.preventDefault()
  )
  generateIphone()
  document.getElementById('make-wallpaper').addEventListener('click', ->
    sendMessage(cmd: 'generateWallpaper', backgroundColor: backgroundColorPicker.value).then((response) ->
      a = document.createElement('a')
      a.href = response.url
      a.download = 'wallpaper.jpeg'
      a.click()
    )
  )
  opened.then(loadIcons)
)