$iphones = {
  se: {
    width: 640
    height: 1136
    iconSize: 120
    xOffset: 32
    xGap: 32
    yOffset: 54
    yGap: 56
    rows: 5
  }
}

$database = null
open = (data) ->
  request = indexedDB.open('wallpaper', 2)
  request.onupgradeneeded = (e) ->
    database = request.result
    if not database.objectStoreNames.contains('images')
      database.createObjectStore('images', keyPath: 'id', autoIncrement: true)
    if not database.objectStoreNames.contains('icons')
      database.createObjectStore('icons', keyPath: 'id', autoIncrement: true)
  request.onsuccess = (e) ->
    $database = request.result
    self.postMessage(promiseId: data.promiseId, status: 201)

saveFile = (data) ->
  # image may have meta rotation data
  getOrientation(data.file).then((orientation) ->
    angle = switch orientation
      when 1 then 0
      when 3 then Math.PI
      when 6 then Math.PI / 2
      when 8 then Math.PI / -2
      else 0
    # convert back to blob
    blob = new Blob([data.file], type: data.type)
    saveBlob = (blob) ->
      generateThumbnail(blob).then((thumbnail) ->
        trxn = $database.transaction(['images'], 'readwrite')
        store = trxn.objectStore('images')
        store.add(
          original:  blob
          thumbnail: thumbnail
        )
        trxn.oncomplete = ->
          url = URL.createObjectURL(thumbnail)
          self.postMessage(promiseId: data.promiseId, url: url, status: 201)
      )
    if angle != 0
      rotateImage(blob, angle).then(saveBlob)
    else
      saveBlob(blob)
  )

getImage = (data) ->
  trxn = $database.transaction(['images'], 'readonly')
  store = trxn.objectStore('images')
  req = store.get(Number(data.id))
  req.onsuccess = (e) ->
    blob = req.result.original
    url = URL.createObjectURL(blob)
    self.postMessage(promiseId: data.promiseId, image: {id: data.id, src: url}, status: 200)

loadImages = (data) ->
  trxn = $database.transaction(['images'], 'readonly')
  store = trxn.objectStore('images')
  results = {}
  req = store.openCursor()
  req.onsuccess = (e) ->
    cursor = req.result
    if cursor?
      image = cursor.value
      results[cursor.key] = URL.createObjectURL(image.thumbnail)
      cursor.continue()
  trxn.oncomplete = ->
    self.postMessage(promiseId: data.promiseId, images: results, status: 200)

# square 120x120 icon
generateIcon = (data) ->
  trxn = $database.transaction(['images'], 'readonly')
  store = trxn.objectStore('images')
  req = store.get(Number(data.id))
  req.onsuccess = (e) ->
    blob = req.result.original
    canvas = new OffscreenCanvas(120,120)
    ctx = canvas.getContext('2d')
    createImageBitmap(blob).then((bitmap) ->
      ctx.drawImage(bitmap, data.dx, data.dy, bitmap.width * data.scale, bitmap.height * data.scale)
      canvas.convertToBlob(
        type: 'image/jpeg',
        quality: 0.95
      ).then((blob) ->
        saveIcon(blob, data.position).then( ->
          self.postMessage(promiseId: data.promiseId, status: 200)
        )
      )
    )

saveIcon = (blob, position) ->
  new Promise((resolve, reject) ->
    trxn = $database.transaction(['icons'], 'readwrite')
    store = trxn.objectStore('icons')
    req = store.put(position: Number(position), icon: blob)
    trxn.oncomplete = resolve
    #TODO: errors
  )

loadIcons = (data) ->
  trxn = $database.transaction(['icons'], 'readonly')
  store = trxn.objectStore('icons')
  results = {}
  req = store.openCursor()
  req.onsuccess = (e) ->
    cursor = req.result
    if cursor?
      icon = cursor.value
      results[icon.position] = URL.createObjectURL(icon.icon)
      cursor.continue()
  trxn.oncomplete = ->
    self.postMessage(promiseId: data.promiseId, icons: results, status: 200)

generateWallpaper = (data) ->
  getPosition = (pos) ->
    row = Math.ceil(pos / 4)
    col = pos % 4
    if col == 0
      col = 4
    [row, col]
  iphone = $iphones.se
  width  = iphone.width
  height = iphone.height
  tmpCanvas = new OffscreenCanvas(120, 120)
  tmpCtx = tmpCanvas.getContext('2d')
  canvas = new OffscreenCanvas(width, height)
  ctx = canvas.getContext('2d')
  ctx.fillStyle = data.backgroundColor
  ctx.fillRect(0, 0, width, height)
  trxn = $database.transaction(['icons'], 'readonly')
  store = trxn.objectStore('icons')
  req = store.getAll()
  getPoints = (str) ->
    str.split(',').map((n) -> Number(n) + 60)
  req.onsuccess = (e) ->
    icons = req.result
    points = iconClipPoints()
    [startX, startY] = getPoints(points.shift())
    icons.reduce((promise, icon) ->
      promise.then( ->
        createImageBitmap(icon.icon).then((bitmap) ->
          #draw clipped icon to tmp canvas
          tmpCtx.clearRect(0, 0, tmpCanvas.width, tmpCanvas.height)
          tmpCtx.globalCompositeOperation = 'source-over'
          tmpCtx.drawImage(bitmap, 0, 0)
          tmpCtx.fillStyle = '#fff'
          tmpCtx.globalCompositeOperation = 'destination-in'
          tmpCtx.beginPath()
          tmpCtx.moveTo(startX, startY)
          for point in points
            [x, y] = getPoints(point)
            tmpCtx.lineTo(x, y)
          tmpCtx.closePath()
          tmpCtx.fill()
          [row, col] = getPosition(icon.position)
          xOffset = iphone.xOffset + ((iphone.iconSize + iphone.xGap) * (col-1))
          yOffset = iphone.yOffset + ((iphone.iconSize + iphone.yGap) * (row-1))
          ctx.drawImage(tmpCanvas, xOffset, yOffset)
        )
      )
    , Promise.resolve()).then( ->
      icons = null
      canvas.convertToBlob(
        type: 'image/jpeg',
        quality: 0.95
      ).then((blob) ->
        url = URL.createObjectURL(blob)
        self.postMessage(promiseId: data.promiseId, url: url, status: 201)
      )
    )

getIphone = (data) ->
  iphone = $iphones.se
  self.postMessage(promiseId: data.promiseId, iphone: iphone, status: 200)

self.addEventListener('message', (e) ->
  switch e.data.cmd
    when 'open'               then open(e.data)
    when 'getSquircle'        then getSquircle(e.data)
    when 'getIphone'          then getIphone(e.data)
    when 'saveFile'           then saveFile(e.data)
    when 'loadImages'         then loadImages(e.data)
    when 'getImage'           then getImage(e.data)
    when 'loadIcons'          then loadIcons(e.data)
    when 'generateIcon'       then generateIcon(e.data)
    when 'generateWallpaper'  then generateWallpaper(e.data)
)

# https://stackoverflow.com/questions/7584794/
getOrientation = (buffer) ->
  new Promise((resolve, reject) ->
    orientation = -1
    view = new DataView(buffer)
    if view.getUint16(0, false) != 0xFFD8
      orientation = -2
    else
      length = view.byteLength
      offset = 2
      while offset < length
        if view.getUint16(offset+2, false) <= 8
          orientation = -1
          break
        else
          marker = view.getUint16(offset, false)
          offset += 2
          if marker == 0xFFE1
            if (view.getUint32(offset += 2, false) != 0x45786966)
              orientation = -1
              break
            else
              little = view.getUint16(offset += 6, false) == 0x4949
              offset += view.getUint32(offset + 4, little)
              tags = view.getUint16(offset, little)
              offset += 2
              for i in [0...tags]
                if (view.getUint16(offset + (i * 12), little) == 0x0112)
                  orientation = (view.getUint16(offset + (i * 12) + 8, little))
                  break
              if orientation > -1
                break
          else if (marker & 0xFF00) != 0xFF00
            break
          else
            offset += view.getUint16(offset, false)
    resolve(orientation)
  )

rotateImage = (blob, angle) ->
  createImageBitmap(blob).then((bitmap) ->
    if angle == Math.PI
      w = bitmap.width
      h = bitmap.height
    else
      w = bitmap.height
      h = bitmap.width
    canvas = new OffscreenCanvas(w, h)
    ctx = canvas.getContext('2d')
    ctx.setTransform(1, 0, 0, 1, w / 2, h / 2)
    ctx.rotate(angle)
    ctx.drawImage(bitmap, -bitmap.width / 2, -bitmap.height / 2)
    canvas.convertToBlob(
      type: 'image/jpeg',
      quality: 0.95
    )
  )

generateThumbnail = (blob) ->
  maxWidth = 300
  createImageBitmap(blob).then((bitmap) ->
    scale = maxWidth / bitmap.width
    height = bitmap.height * scale
    canvas = new OffscreenCanvas(maxWidth, height)
    ctx = canvas.getContext('2d')
    ctx.drawImage(bitmap, 0, 0, bitmap.width, bitmap.height, 0, 0, maxWidth, height)
    canvas.convertToBlob(
      type: 'image/jpeg',
      quality: 0.95
    )
  )

getSquircle = (data) ->
  points = iconClipPoints()
  self.postMessage(promiseId: data.promiseId, points: points, status: 201)

# generate squircle clip path
iconClipPoints = ->
  squircle = (x)->
    (((1 - (Math.abs(x / 60) ** 5)) ** 0.2) * 60).toFixed(2)

  points = []
  x = 0
  while x <= 25
    points.push("#{x},#{squircle(x)}")
    x = x + 1
  while x <= 60
    points.push("#{x.toFixed(2)},#{squircle(x)}")
    x = x + 0.1

  _points = []
  x = 0
  while x <= 25
    _points.push("#{x},#{squircle(x) * -1.0}")
    x = x + 1
  while x <= 60
    _points.push("#{x.toFixed(2)},#{squircle(x) * -1.0}")
    x = x + 0.1
  points = points.concat(_points.reverse())

  x = 0
  while x <= 25
    points.push("-#{x},#{squircle(x) * -1.0}")
    x = x + 1
  while x <= 60
    points.push("-#{x.toFixed(2)},#{squircle(x) * -1.0}")
    x = x + 0.1

  _points.length = 0
  x = 0
  while x <= 25
    _points.push("-#{x},#{squircle(x)}")
    x = x + 1
  while x <= 60
    _points.push("-#{x.toFixed(2)},#{squircle(x)}")
    x = x + 0.1
  points = points.concat(_points.reverse())
