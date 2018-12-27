# __worker__ 
$worker = new Worker('__worker__', name: 'wallpaper')
$palette = null
$maxWidth = 150
$iphone = null

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


loadIcon = (url, position) ->
  position = Number(position)
  placeholder = document.querySelector("#iphone svg g rect[data-position='#{position}']")
  g = placeholder.parentElement
  placeholder?.removeEventListener('drop', iconImageDrop)
  img = createSVGElement('image')
  img.setAttributeNS('http://www.w3.org/1999/xlink', 'href', url)
  img.setAttribute('x', $iphone.iconSize / -2)
  img.setAttribute('y', $iphone.iconSize / -2)
  img.setAttribute('width', $iphone.iconSize)
  img.setAttribute('height', $iphone.iconSize)
  img.setAttribute('clip-path', 'url(#icon)')
  g.replaceChild(img, placeholder)

loadIcons = ->
  sendMessage(cmd: 'loadIcons').then((e) ->
    for position, url of e.icons
      loadIcon(url, position)
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
    dx = (ctm.e / 2) - x + ($iphone.iconSize / 2)
    dy = (ctm.f / 2) - y + ($iphone.iconSize / 2)
    sendMessage({cmd: 'generateIcon', id: image.id, scale, dx, dy, position}).then((response) ->
      emptyElement(div)
      document.body.removeChild(div)
      loadIcon(response.url, position)
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

createSVGElement = (tagName) ->
  document.createElementNS('http://www.w3.org/2000/svg', tagName)

generateIphone = ->
  div = document.getElementById('iphone')
  emptyElement(div)
  sendMessage(cmd: 'getIphone', model: this.value).then((r1) ->
    $iphone = r1.iphone
    sendMessage(cmd: 'getSquircle').then((r2) ->
      points = r2.points
      svg = createSVGElement('svg')
      svg.setAttribute('width', $iphone.width / $iphone.scale)
      svg.setAttribute('height', $iphone.height / $iphone.scale)
      svg.setAttribute('viewBox', "0 0 #{$iphone.width} #{$iphone.height}")
      defs = createSVGElement('defs')
      svg.appendChild(defs)
      clipPath = createSVGElement('clipPath')
      defs.appendChild(clipPath)
      clipPath.setAttribute('id', 'icon')
      clipPath.appendChild(iconClipPolygon(points))
      # delete button
      path = createSVGElement('path')
      path.setAttribute('id', 'remove')
      path.setAttribute('d', 'M 0,0 a 24 24 0 0 0 0,48 a 24 24 0 0 0 0,-48 z')
      defs.appendChild(path)
      getPosition = (pos) ->
        row = Math.ceil(pos / 4)
        col = pos % 4
        if col == 0
          col = 4
        [row, col]
      halfIcon = $iphone.iconSize / 2
      [1..(4*$iphone.rows)].forEach((position) ->
        [row, col] = getPosition(position)
        g = createSVGElement('g')
        xOffset = $iphone.xOffset + (($iphone.iconSize + $iphone.xGap) * (col-1))
        yOffset = $iphone.yOffset + (($iphone.iconSize + $iphone.yGap) * (row-1))
        g.setAttribute('transform', "translate(#{xOffset+halfIcon}, #{yOffset+halfIcon})")
        placeholder = createSVGElement('rect')
        placeholder.classList.add('icon')
        placeholder.setAttribute('x', -halfIcon)
        placeholder.setAttribute('y', -halfIcon)
        placeholder.setAttribute('width', $iphone.iconSize)
        placeholder.setAttribute('height', $iphone.iconSize)
        placeholder.setAttribute('clip-path', 'url(#icon)')
        placeholder.setAttribute('data-position', position)
        g.appendChild(placeholder)
        placeholder.addEventListener('drop', iconImageDrop)
        button = createSVGElement('use')
        button.classList.add('remove')
        button.setAttributeNS('http://www.w3.org/1999/xlink', 'href', '#remove')
        button.setAttribute('x', -halfIcon)
        button.setAttribute('y', -halfIcon-24)
        button.addEventListener('click', deleteIcon)
        g.appendChild(button)
        svg.appendChild(g)
      )
      div.appendChild(svg)
      loadIcons()
    )
  )

deleteIcon = (e) ->
  alert 'delete'

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
  modelSelect = document.getElementById('model')
  modelSelect.addEventListener('change', ->
    generateIphone.call(this)
  )
  opened.then( ->
    generateIphone.call(modelSelect)
  )
  document.getElementById('make-wallpaper').addEventListener('click', ->
    sendMessage(cmd: 'generateWallpaper', backgroundColor: backgroundColorPicker.value).then((response) ->
      a = document.createElement('a')
      a.href = response.url
      a.download = 'wallpaper.jpeg'
      a.click()
    )
  )
)