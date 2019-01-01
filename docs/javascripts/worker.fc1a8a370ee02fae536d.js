(function() {
  // https://www.paintcodeapp.com/news/ultimate-guide-to-iphone-resolutions
  var $database, $iphone, $iphones, deleteIcon, deletePhotos, generateIcon, generateThumbnail, generateWallpaper, getImage, getIphone, getOrientation, getSquircle, iconClipPoints, loadIcons, loadImages, open, rotateImage, saveFile, saveIcon;

  $iphones = {
    se: {
      scale: 2,
      width: 640,
      height: 1136,
      iconSize: 120,
      xOffset: 32,
      xGap: 32,
      yOffset: 54,
      yGap: 56,
      rows: 5
    },
    eight: {
      scale: 2,
      width: 750,
      height: 1334,
      iconSize: 120,
      xOffset: 54,
      xGap: 56,
      yOffset: 56,
      yGap: 54,
      rows: 6
    },
    eightplus: {
      scale: 3,
      width: 1242,
      height: 2208,
      iconSize: 180,
      xOffset: 105,
      xGap: 104,
      yOffset: 114,
      yGap: 120,
      rows: 6
    },
    xs: {
      scale: 3,
      width: 1125,
      height: 2436,
      iconSize: 180,
      xOffset: 81,
      xGap: 81,
      yOffset: 216,
      yGap: 126,
      rows: 6
    },
    xr: {
      scale: 2,
      width: 828,
      height: 1792,
      iconSize: 128,
      xOffset: 64,
      xGap: 62,
      yOffset: 156,
      yGap: 96,
      rows: 6
    },
    xsmax: {
      scale: 3,
      width: 1242,
      height: 2688,
      iconSize: 192,
      xOffset: 96,
      xGap: 94,
      yOffset: 234,
      yGap: 145,
      rows: 6
    }
  };

  $iphone = null;

  $database = null;

  open = function(data) {
    var request;
    request = indexedDB.open('wallpaper', 2);
    request.onupgradeneeded = function(e) {
      var database;
      database = request.result;
      if (!database.objectStoreNames.contains('images')) {
        database.createObjectStore('images', {
          keyPath: 'id',
          autoIncrement: true
        });
      }
      if (!database.objectStoreNames.contains('icons')) {
        return database.createObjectStore('icons', {
          keyPath: 'id',
          autoIncrement: true
        });
      }
    };
    return request.onsuccess = function(e) {
      $database = request.result;
      return self.postMessage({
        promiseId: data.promiseId,
        status: 201
      });
    };
  };

  saveFile = function(data) {
    // image may have meta rotation data
    return getOrientation(data.file).then(function(orientation) {
      var angle, blob, saveBlob;
      angle = (function() {
        switch (orientation) {
          case 1:
            return 0;
          case 3:
            return Math.PI;
          case 6:
            return Math.PI / 2;
          case 8:
            return Math.PI / -2;
          default:
            return 0;
        }
      })();
      // convert back to blob
      blob = new Blob([data.file], {
        type: data.type
      });
      saveBlob = function(blob) {
        return generateThumbnail(blob).then(function(thumbnail) {
          var req, store, trxn;
          trxn = $database.transaction(['images'], 'readwrite');
          store = trxn.objectStore('images');
          req = store.add({
            original: blob,
            thumbnail: thumbnail
          });
          return req.onsuccess = function() {
            var id, url;
            id = req.result;
            url = URL.createObjectURL(thumbnail);
            return self.postMessage({
              promiseId: data.promiseId,
              id: id,
              url: url,
              status: 201
            });
          };
        });
      };
      // trxn.oncomplete = ->
      if (angle !== 0) {
        return rotateImage(blob, angle).then(saveBlob);
      } else {
        return saveBlob(blob);
      }
    });
  };

  getImage = function(data) {
    var req, store, trxn;
    trxn = $database.transaction(['images'], 'readonly');
    store = trxn.objectStore('images');
    req = store.get(Number(data.id));
    return req.onsuccess = function(e) {
      var blob, url;
      blob = req.result.original;
      url = URL.createObjectURL(blob);
      return self.postMessage({
        promiseId: data.promiseId,
        image: {
          id: data.id,
          src: url
        },
        status: 200
      });
    };
  };

  loadImages = function(data) {
    var req, results, store, trxn;
    trxn = $database.transaction(['images'], 'readonly');
    store = trxn.objectStore('images');
    results = {};
    req = store.openCursor();
    req.onsuccess = function(e) {
      var cursor, image;
      cursor = req.result;
      if (cursor != null) {
        image = cursor.value;
        results[cursor.key] = URL.createObjectURL(image.thumbnail);
        return cursor.continue();
      }
    };
    return trxn.oncomplete = function() {
      return self.postMessage({
        promiseId: data.promiseId,
        images: results,
        status: 200
      });
    };
  };

  // square icon
  generateIcon = function(data) {
    var req, requestedSize, store, trxn;
    trxn = $database.transaction(['images'], 'readonly');
    store = trxn.objectStore('images');
    req = store.get(Number(data.id));
    requestedSize = $iphone.iconSize;
    return req.onsuccess = function(e) {
      var blob, sh, sizes, sw, x, y;
      blob = req.result.original;
      sizes = Object.values($iphones).map(function(model) {
        return model.iconSize;
      }).filter(function(e, i, a) {
        return a.indexOf(e) === i;
      });
      // make icon for each iphone model
      x = Math.round(data.dx / data.scale) * -1;
      y = Math.round(data.dy / data.scale) * -1;
      sw = sh = Math.round(requestedSize / data.scale);
      return Promise.all(sizes.map(function(size) {
        var canvas, ctx;
        canvas = new OffscreenCanvas(size, size);
        ctx = canvas.getContext('2d');
        return createImageBitmap(blob, x, y, sw, sh, {
          resizeWidth: size,
          resizeHeight: size,
          resizeQuality: 'high'
        }).then(function(bitmap) {
          ctx.drawImage(bitmap, 0, 0);
          return canvas.convertToBlob({
            type: 'image/jpeg',
            quality: 0.95
          }).then(function(blob) {
            return {size, blob};
          });
        });
      })).then(function(icons) {
        blob = icons.find(function(i) {
          return i.size === requestedSize;
        }).blob;
        return saveIcon(icons, data.position).then(function(id) {
          var position, url;
          position = data.position;
          url = URL.createObjectURL(blob);
          return self.postMessage({
            promiseId: data.promiseId,
            icon: {id, position, url},
            status: 201
          });
        });
      });
    };
  };

  saveIcon = function(icons, position) {
    return new Promise(function(resolve, reject) {
      var req, store, trxn;
      trxn = $database.transaction(['icons'], 'readwrite');
      store = trxn.objectStore('icons');
      req = store.put({
        position: Number(position),
        icons: icons
      });
      return req.onsuccess = function() {
        var id;
        id = req.result;
        return resolve(id);
      };
    });
  };

  // trxn.oncomplete = resolve
  //TODO: errors
  loadIcons = function(data) {
    var req, results, store, trxn;
    trxn = $database.transaction(['icons'], 'readonly');
    store = trxn.objectStore('icons');
    results = [];
    req = store.openCursor();
    req.onsuccess = function(e) {
      var blob, cursor, icon;
      cursor = req.result;
      if (cursor != null) {
        icon = cursor.value;
        blob = icon.icons.find(function(i) {
          return i.size === $iphone.iconSize;
        }).blob;
        results.push({
          position: icon.position,
          url: URL.createObjectURL(blob),
          id: icon.id
        });
        return cursor.continue();
      }
    };
    return trxn.oncomplete = function() {
      return self.postMessage({
        promiseId: data.promiseId,
        icons: results,
        status: 200
      });
    };
  };

  generateWallpaper = function(data) {
    var canvas, ctx, getPoints, getPosition, height, req, size, store, tmpCanvas, tmpCtx, trxn, width;
    getPosition = function(pos) {
      var col, row;
      row = Math.ceil(pos / 4);
      col = pos % 4;
      if (col === 0) {
        col = 4;
      }
      return [row, col];
    };
    width = $iphone.width;
    height = $iphone.height;
    tmpCanvas = new OffscreenCanvas($iphone.iconSize, $iphone.iconSize);
    tmpCtx = tmpCanvas.getContext('2d');
    canvas = new OffscreenCanvas(width, height);
    ctx = canvas.getContext('2d');
    ctx.fillStyle = data.backgroundColor;
    ctx.fillRect(0, 0, width, height);
    trxn = $database.transaction(['icons'], 'readonly');
    store = trxn.objectStore('icons');
    req = store.getAll();
    size = $iphone.iconSize / 2;
    getPoints = function(str) {
      return str.split(',').map(function(n) {
        return Number(n) + size;
      });
    };
    return req.onsuccess = function(e) {
      var icons, points, startX, startY;
      icons = req.result;
      points = iconClipPoints(size);
      [startX, startY] = getPoints(points.shift());
      return icons.reduce(function(promise, icon) {
        return promise.then(function() {
          var blob;
          blob = icon.icons.find(function(i) {
            return i.size === $iphone.iconSize;
          }).blob;
          return createImageBitmap(blob).then(function(bitmap) {
            var col, j, len, point, row, x, xOffset, y, yOffset;
            //draw clipped icon to tmp canvas
            tmpCtx.clearRect(0, 0, tmpCanvas.width, tmpCanvas.height);
            tmpCtx.globalCompositeOperation = 'source-over';
            tmpCtx.drawImage(bitmap, 0, 0);
            tmpCtx.fillStyle = '#fff';
            tmpCtx.globalCompositeOperation = 'destination-in';
            tmpCtx.beginPath();
            tmpCtx.moveTo(startX, startY);
            for (j = 0, len = points.length; j < len; j++) {
              point = points[j];
              [x, y] = getPoints(point);
              tmpCtx.lineTo(x, y);
            }
            tmpCtx.closePath();
            tmpCtx.fill();
            [row, col] = getPosition(icon.position);
            xOffset = $iphone.xOffset + (($iphone.iconSize + $iphone.xGap) * (col - 1));
            yOffset = $iphone.yOffset + (($iphone.iconSize + $iphone.yGap) * (row - 1));
            return ctx.drawImage(tmpCanvas, xOffset, yOffset);
          });
        });
      }, Promise.resolve()).then(function() {
        icons = null;
        return canvas.convertToBlob({
          type: 'image/jpeg',
          quality: 0.95
        }).then(function(blob) {
          var url;
          url = URL.createObjectURL(blob);
          return self.postMessage({
            promiseId: data.promiseId,
            url: url,
            status: 201
          });
        });
      });
    };
  };

  getIphone = function(data) {
    $iphone = $iphones[data.model];
    return self.postMessage({
      promiseId: data.promiseId,
      iphone: $iphone,
      status: 200
    });
  };

  deletePhotos = function(data) {
    var store, trxn;
    trxn = $database.transaction(['images'], 'readwrite');
    store = trxn.objectStore('images');
    store.clear();
    return trxn.oncomplete = function() {
      return self.postMessage({
        promiseId: data.promiseId,
        status: 204
      });
    };
  };

  deleteIcon = function(data) {
    var store, trxn;
    trxn = $database.transaction(['icons'], 'readwrite');
    store = trxn.objectStore('icons');
    store.delete(data.id);
    return trxn.oncomplete = function() {
      return self.postMessage({
        promiseId: data.promiseId,
        status: 204
      });
    };
  };

  self.addEventListener('message', function(e) {
    switch (e.data.cmd) {
      case 'open':
        return open(e.data);
      case 'getSquircle':
        return getSquircle(e.data);
      case 'getIphone':
        return getIphone(e.data);
      case 'saveFile':
        return saveFile(e.data);
      case 'loadImages':
        return loadImages(e.data);
      case 'getImage':
        return getImage(e.data);
      case 'loadIcons':
        return loadIcons(e.data);
      case 'deleteIcon':
        return deleteIcon(e.data);
      case 'generateIcon':
        return generateIcon(e.data);
      case 'generateWallpaper':
        return generateWallpaper(e.data);
      case 'deletePhotos':
        return deletePhotos(e.data);
    }
  });

  // https://stackoverflow.com/questions/7584794/
  getOrientation = function(buffer) {
    return new Promise(function(resolve, reject) {
      var i, j, length, little, marker, offset, orientation, ref, tags, view;
      orientation = -1;
      view = new DataView(buffer);
      if (view.getUint16(0, false) !== 0xFFD8) {
        orientation = -2;
      } else {
        length = view.byteLength;
        offset = 2;
        while (offset < length) {
          if (view.getUint16(offset + 2, false) <= 8) {
            orientation = -1;
            break;
          } else {
            marker = view.getUint16(offset, false);
            offset += 2;
            if (marker === 0xFFE1) {
              if (view.getUint32(offset += 2, false) !== 0x45786966) {
                orientation = -1;
                break;
              } else {
                little = view.getUint16(offset += 6, false) === 0x4949;
                offset += view.getUint32(offset + 4, little);
                tags = view.getUint16(offset, little);
                offset += 2;
                for (i = j = 0, ref = tags; (0 <= ref ? j < ref : j > ref); i = 0 <= ref ? ++j : --j) {
                  if (view.getUint16(offset + (i * 12), little) === 0x0112) {
                    orientation = view.getUint16(offset + (i * 12) + 8, little);
                    break;
                  }
                }
                if (orientation > -1) {
                  break;
                }
              }
            } else if ((marker & 0xFF00) !== 0xFF00) {
              break;
            } else {
              offset += view.getUint16(offset, false);
            }
          }
        }
      }
      return resolve(orientation);
    });
  };

  rotateImage = function(blob, angle) {
    return createImageBitmap(blob).then(function(bitmap) {
      var canvas, ctx, h, w;
      if (angle === Math.PI) {
        w = bitmap.width;
        h = bitmap.height;
      } else {
        w = bitmap.height;
        h = bitmap.width;
      }
      canvas = new OffscreenCanvas(w, h);
      ctx = canvas.getContext('2d');
      ctx.setTransform(1, 0, 0, 1, w / 2, h / 2);
      ctx.rotate(angle);
      ctx.drawImage(bitmap, -bitmap.width / 2, -bitmap.height / 2);
      return canvas.convertToBlob({
        type: 'image/jpeg',
        quality: 0.95
      });
    });
  };

  generateThumbnail = function(blob) {
    var maxWidth;
    maxWidth = 300;
    return createImageBitmap(blob, {
      resizeWidth: maxWidth,
      resizeQuality: 'high'
    }).then(function(bitmap) {
      var canvas, ctx;
      canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
      ctx = canvas.getContext('2d');
      ctx.drawImage(bitmap, 0, 0);
      return canvas.convertToBlob({
        type: 'image/jpeg',
        quality: 0.95
      });
    });
  };

  getSquircle = function(data) {
    var points, size;
    size = $iphone.iconSize / 2;
    points = iconClipPoints(size);
    return self.postMessage({
      promiseId: data.promiseId,
      points: points,
      status: 201
    });
  };

  // generate squircle clip path
  iconClipPoints = function(size) {
    var _points, points, squircle, x;
    squircle = function(x) {
      return (((1 - (Math.abs(x / size) ** 5)) ** 0.2) * size).toFixed(2);
    };
    points = [];
    x = 0;
    while (x <= (size / 2.4)) {
      points.push(`${x},${squircle(x)}`);
      x = x + 1;
    }
    while (x <= size) {
      points.push(`${x.toFixed(2)},${squircle(x)}`);
      x = x + 0.1;
    }
    _points = [];
    x = 0;
    while (x <= (size / 2.4)) {
      _points.push(`${x},${squircle(x) * -1.0}`);
      x = x + 1;
    }
    while (x <= size) {
      _points.push(`${x.toFixed(2)},${squircle(x) * -1.0}`);
      x = x + 0.1;
    }
    points = points.concat(_points.reverse());
    x = 0;
    while (x <= (size / 2.4)) {
      points.push(`-${x},${squircle(x) * -1.0}`);
      x = x + 1;
    }
    while (x <= size) {
      points.push(`-${x.toFixed(2)},${squircle(x) * -1.0}`);
      x = x + 0.1;
    }
    _points.length = 0;
    x = 0;
    while (x <= (size / 2.4)) {
      _points.push(`-${x},${squircle(x)}`);
      x = x + 1;
    }
    while (x <= size) {
      _points.push(`-${x.toFixed(2)},${squircle(x)}`);
      x = x + 0.1;
    }
    return points = points.concat(_points.reverse());
  };

}).call(this);
