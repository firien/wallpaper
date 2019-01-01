(function() {
  // javascripts/worker.fc1a8a370ee02fae536d.js 
  var $iphone, $maxWidth, $palette, $worker, createSVGElement, deleteIcon, deletePhotos, emptyElement, fileDropHandler, generateIphone, iconClipPolygon, iconImageDragStart, iconImageDrop, initScale, initTranslation, loadIcon, loadIcons, loadImages, positionImage, sendMessage, setBackground;

  $worker = new Worker('javascripts/worker.fc1a8a370ee02fae536d.js', {
    name: 'wallpaper'
  });

  $palette = null;

  $maxWidth = 150;

  $iphone = null;

  sendMessage = function(opts, buffers) {
    opts.promiseId = nanoid(16);
    return new Promise(function(resolve, reject) {
      var listener;
      listener = function(e) {
        if (e.data.promiseId === opts.promiseId) {
          if (/2\d\d/.test(String(e.data.status))) {
            resolve(e.data);
          } else {
            reject(e.data);
          }
          return $worker.removeEventListener('message', listener);
        }
      };
      $worker.addEventListener('message', listener);
      return $worker.postMessage(opts, buffers);
    });
  };

  fileDropHandler = function(e) {
    var container, files, ref;
    if (((ref = e.dataTransfer.files) != null ? ref.length : void 0) > 0) {
      e.stopPropagation();
      e.preventDefault();
      files = Array.prototype.slice.call(e.dataTransfer.files);
      container = document.getElementById('gallery');
      return files.forEach(function(file) {
        var image;
        image = new Image();
        image.setAttribute('width', $maxWidth);
        image.setAttribute('height', $maxWidth);
        container.appendChild(image);
        return new Response(file).arrayBuffer().then(function(buffer) {
          return sendMessage({
            cmd: 'saveFile',
            file: buffer,
            type: file.type
          }, [buffer]).then(function(response) {
            image.onload = function() {
              this.setAttribute('height', this.naturalHeight / 2);
              this.setAttribute('draggable', 'true');
              this.setAttribute('data-id', response.id);
              return this.addEventListener('dragstart', iconImageDragStart);
            };
            return image.src = response.url;
          });
        });
      });
    }
  };

  emptyElement = function(element) {
    var results;
    results = [];
    while (element.firstChild) {
      results.push(element.removeChild(element.firstChild));
    }
    return results;
  };

  loadIcon = function(icon) {
    var g, img, placeholder, position;
    position = Number(icon.position);
    placeholder = document.querySelector(`#iphone svg g rect[data-position='${position}']`);
    // if icon was created on a large iphone and now a smaller model is loaded - the position may not exist
    if (placeholder != null) {
      g = placeholder.parentElement;
      img = createSVGElement('image');
      img.setAttributeNS('http://www.w3.org/1999/xlink', 'href', icon.url);
      img.setAttribute('x', $iphone.iconSize / -2);
      img.setAttribute('y', $iphone.iconSize / -2);
      img.setAttribute('width', $iphone.iconSize);
      img.setAttribute('height', $iphone.iconSize);
      img.setAttribute('clip-path', 'url(#icon)');
      g.setAttribute('data-id', icon.id);
      return g.insertBefore(img, placeholder);
    }
  };

  loadIcons = function() {
    return sendMessage({
      cmd: 'loadIcons'
    }).then(function(e) {
      return e.icons.forEach(loadIcon);
    });
  };

  loadImages = function() {
    var container;
    container = document.getElementById('gallery');
    emptyElement(container);
    return sendMessage({
      cmd: 'loadImages'
    }).then(function(e) {
      var i, image, key, keys, len, results, url;
      keys = Object.keys(e.images).map(function(n) {
        return Number(n);
      }).sort(function(a, b) {
        return a - b;
      });
      results = [];
      for (i = 0, len = keys.length; i < len; i++) {
        key = keys[i];
        url = e.images[key];
        image = new Image();
        image.setAttribute('width', $maxWidth);
        image.setAttribute('data-id', key);
        image.onload = function() {
          this.setAttribute('height', this.naturalHeight / 2);
          return this.setAttribute('draggable', 'true');
        };
        image.src = url;
        container.appendChild(image);
        image.addEventListener('dragstart', iconImageDragStart);
        results.push(image);
      }
      return results;
    });
  };

  iconImageDragStart = function(e) {
    var el, i, len, ref, results;
    e.dataTransfer.setData('application/json', JSON.stringify({
      id: this.getAttribute('data-id')
    }));
    ref = document.querySelectorAll('.icon');
    results = [];
    for (i = 0, len = ref.length; i < len; i++) {
      el = ref[i];
      el.addEventListener('dragover', function(e) {
        e.preventDefault();
        return this.classList.add('over');
      });
      results.push(el.addEventListener('dragleave', function(e) {
        e.preventDefault();
        return this.classList.remove('over');
      }));
    }
    return results;
  };

  iconImageDrop = function(e) {
    var image, position;
    position = this.getAttribute('data-position');
    this.classList.remove('over');
    image = JSON.parse(e.dataTransfer.getData('application/json'));
    return sendMessage({
      cmd: 'getImage',
      id: image.id
    }).then(function(response) {
      return positionImage(response.image, position);
    });
  };

  positionImage = function(image, position) {
    var bar, cancelButton, div, img, m, polygon, submitButton, svg, t, x, y;
    div = document.createElement('div');
    div.classList.add('modal');
    svg = createSVGElement('svg');
    svg.setAttribute('width', window.innerWidth);
    svg.setAttribute('height', window.innerHeight);
    svg.setAttribute('viewBox', `0 0 ${window.innerWidth} ${window.innerHeight}`);
    div.appendChild(svg);
    img = createSVGElement('image');
    img.setAttributeNS('http://www.w3.org/1999/xlink', 'href', image.src);
    m = svg.createSVGMatrix().scale(2);
    t = svg.createSVGTransformFromMatrix(m);
    img.transform.baseVal.appendItem(t);
    svg.appendChild(img);
    polygon = document.querySelector('#iphone defs polygon').cloneNode();
    polygon.classList.add('frame');
    x = innerWidth / 4;
    y = innerHeight / 4;
    // TODO: window resizes will wreak havoc with this
    polygon.setAttribute('transform', `scale(2) translate(${x},${y})`);
    svg.appendChild(polygon);
    document.body.appendChild(div);
    img.addEventListener('pointerdown', initTranslation);
    img.addEventListener('mousewheel', initScale);
    bar = document.createElement('div');
    bar.classList.add('button-bar');
    cancelButton = document.createElement('button');
    cancelButton.setAttribute('type', 'button');
    cancelButton.textContent = 'Cancel';
    bar.appendChild(cancelButton);
    submitButton = document.createElement('button');
    submitButton.setAttribute('type', 'button');
    submitButton.textContent = 'Set';
    bar.appendChild(submitButton);
    div.appendChild(bar);
    cancelButton.addEventListener('click', function(e) {
      emptyElement(div);
      return document.body.removeChild(div);
    });
    return submitButton.addEventListener('click', function(e) {
      var ctm, dx, dy, scale;
      img.removeEventListener('pointerdown', initTranslation);
      ctm = img.getCTM();
      // position relative to icon target
      scale = ctm.a / 2;
      dx = (ctm.e / 2) - x + ($iphone.iconSize / 2);
      dy = (ctm.f / 2) - y + ($iphone.iconSize / 2);
      return sendMessage({
        cmd: 'generateIcon',
        id: image.id,
        scale,
        dx,
        dy,
        position
      }).then(function(response) {
        emptyElement(div);
        document.body.removeChild(div);
        return loadIcon(response.icon);
      });
    });
  };

  initScale = function(e) {
    var ctm, newScale, scale, svg, t;
    svg = this.parentNode;
    e.preventDefault();
    e.stopPropagation();
    ctm = this.getCTM();
    scale = 1 + ((e.wheelDelta || -e.detail) / 300);
    scale = Math.max(0.1, Math.min(2, scale));
    newScale = ctm.a * scale;
    if ((newScale > .1) && (newScale < 2)) {
      t = svg.createSVGTransformFromMatrix(ctm.scale(scale));
      this.transform.baseVal.clear();
      return this.transform.baseVal.appendItem(t);
    }
  };

  initTranslation = function(e) {
    var ctm, image, inverseMatrix, pointermove, pointerup, startPoint, svg;
    image = this;
    svg = image.parentNode;
    ctm = image.getCTM();
    startPoint = svg.createSVGPoint();
    startPoint.x = e.clientX;
    startPoint.y = e.clientY;
    inverseMatrix = ctm.inverse();
    startPoint = startPoint.matrixTransform(inverseMatrix);
    pointermove = function(e) {
      var currentPoint, deltaX, deltaY, t;
      currentPoint = svg.createSVGPoint();
      currentPoint.x = e.clientX;
      currentPoint.y = e.clientY;
      currentPoint = currentPoint.matrixTransform(inverseMatrix);
      deltaX = currentPoint.x - startPoint.x;
      deltaY = currentPoint.y - startPoint.y;
      t = svg.createSVGTransformFromMatrix(ctm.translate(deltaX, deltaY));
      image.transform.baseVal.clear();
      return image.transform.baseVal.appendItem(t);
    };
    pointerup = function(e) {
      window.removeEventListener('pointermove', pointermove);
      return window.removeEventListener('pointerup', pointerup);
    };
    window.addEventListener('pointermove', pointermove);
    return window.addEventListener('pointerup', pointerup);
  };

  setBackground = function(e) {
    $palette.parentElement.style.backgroundColor = this.value;
    try {
      return typeof localStorage !== "undefined" && localStorage !== null ? localStorage.setItem('background-color', this.value) : void 0;
    } catch (error) {
      e = error;
      return null;
    }
  };

  createSVGElement = function(tagName) {
    return document.createElementNS('http://www.w3.org/2000/svg', tagName);
  };

  generateIphone = function() {
    var div;
    div = document.getElementById('iphone');
    emptyElement(div);
    return sendMessage({
      cmd: 'getIphone',
      model: this.value
    }).then(function(r1) {
      $iphone = r1.iphone;
      return sendMessage({
        cmd: 'getSquircle'
      }).then(function(r2) {
        var circle, clipPath, defs, getPosition, groupButton, halfIcon, path, points, ref, svg;
        points = r2.points;
        svg = createSVGElement('svg');
        svg.setAttribute('width', $iphone.width / $iphone.scale);
        svg.setAttribute('height', $iphone.height / $iphone.scale);
        svg.setAttribute('viewBox', `0 0 ${$iphone.width} ${$iphone.height}`);
        defs = createSVGElement('defs');
        svg.appendChild(defs);
        clipPath = createSVGElement('clipPath');
        defs.appendChild(clipPath);
        clipPath.setAttribute('id', 'icon');
        clipPath.appendChild(iconClipPolygon(points));
        // delete button
        groupButton = createSVGElement('g');
        groupButton.setAttribute('id', 'remove');
        groupButton.setAttribute('transform', 'rotate(45)');
        circle = createSVGElement('circle');
        circle.setAttribute('cx', 0);
        circle.setAttribute('cy', 0);
        circle.setAttribute('r', 24);
        circle.setAttribute('fill', 'rgba(255,255,255,0.9)');
        groupButton.appendChild(circle);
        path = createSVGElement('path');
        path.setAttribute('d', 'M -2,-16 h 4 v 32 h -4 z M -16,-2 h 32 v 4 h -32 z');
        path.setAttribute('fill', '#444');
        groupButton.appendChild(path);
        defs.appendChild(groupButton);
        getPosition = function(pos) {
          var col, row;
          row = Math.ceil(pos / 4);
          col = pos % 4;
          if (col === 0) {
            col = 4;
          }
          return [row, col];
        };
        halfIcon = $iphone.iconSize / 2;
        (function() {
          var results = [];
          for (var i = 1, ref = 4 * $iphone.rows; 1 <= ref ? i <= ref : i >= ref; 1 <= ref ? i++ : i--){ results.push(i); }
          return results;
        }).apply(this).forEach(function(position) {
          var button, col, g, placeholder, row, xOffset, yOffset;
          [row, col] = getPosition(position);
          g = createSVGElement('g');
          xOffset = $iphone.xOffset + (($iphone.iconSize + $iphone.xGap) * (col - 1));
          yOffset = $iphone.yOffset + (($iphone.iconSize + $iphone.yGap) * (row - 1));
          g.setAttribute('transform', `translate(${xOffset + halfIcon}, ${yOffset + halfIcon})`);
          placeholder = createSVGElement('rect');
          placeholder.classList.add('icon');
          placeholder.setAttribute('x', -halfIcon);
          placeholder.setAttribute('y', -halfIcon);
          placeholder.setAttribute('width', $iphone.iconSize);
          placeholder.setAttribute('height', $iphone.iconSize);
          placeholder.setAttribute('clip-path', 'url(#icon)');
          placeholder.setAttribute('data-position', position);
          g.appendChild(placeholder);
          placeholder.addEventListener('drop', iconImageDrop);
          button = createSVGElement('use');
          button.classList.add('remove');
          button.setAttributeNS('http://www.w3.org/1999/xlink', 'href', '#remove');
          button.setAttribute('x', -halfIcon);
          button.setAttribute('y', -halfIcon);
          button.addEventListener('click', deleteIcon);
          g.appendChild(button);
          return svg.appendChild(g);
        });
        div.appendChild(svg);
        return loadIcons();
      });
    });
  };

  deleteIcon = function(e) {
    var g, id, img;
    g = this.parentNode;
    img = g.querySelector('image');
    id = Number(g.getAttribute('data-id'));
    return sendMessage({
      cmd: 'deleteIcon',
      id: id
    }).then(function() {
      g.removeAttribute('data-id');
      return g.removeChild(img);
    });
  };

  deletePhotos = function() {
    return sendMessage({
      cmd: 'deletePhotos'
    }).then(function() {
      return emptyElement(document.getElementById('gallery'));
    });
  };

  iconClipPolygon = function(points) {
    var polygon;
    polygon = createSVGElement('polygon');
    polygon.setAttribute('points', points.join(' '));
    return polygon;
  };

  document.addEventListener('DOMContentLoaded', function() {
    var backgroundColorPicker, e, initBackgroundColor, modelSelect, opened;
    opened = sendMessage({
      cmd: 'open'
    }).then(loadImages);
    $palette = document.getElementById('palette');
    // store background 
    backgroundColorPicker = document.getElementById('background-color');
    backgroundColorPicker.addEventListener('change', setBackground);
    try {
      initBackgroundColor = typeof localStorage !== "undefined" && localStorage !== null ? localStorage.getItem('background-color') : void 0;
      if (initBackgroundColor != null) {
        backgroundColorPicker.value = initBackgroundColor;
        setBackground.call(backgroundColorPicker);
      }
    } catch (error) {
      e = error;
      null;
    }
    document.getElementById('delete-photos').addEventListener('click', deletePhotos);
    document.addEventListener('drop', fileDropHandler);
    document.addEventListener('dragover', function(e) {
      return e.preventDefault();
    });
    modelSelect = document.getElementById('model');
    modelSelect.addEventListener('change', function() {
      return generateIphone.call(this);
    });
    opened.then(function() {
      return generateIphone.call(modelSelect);
    });
    return document.getElementById('make-wallpaper').addEventListener('click', function() {
      return sendMessage({
        cmd: 'generateWallpaper',
        backgroundColor: backgroundColorPicker.value
      }).then(function(response) {
        var a;
        a = document.createElement('a');
        a.href = response.url;
        a.download = 'wallpaper.jpeg';
        return a.click();
      });
    });
  });

}).call(this);
