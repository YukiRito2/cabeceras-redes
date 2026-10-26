(function(){
  "use strict";

  // ---------- data: exact header layouts from the course infographic ----------
  // Each header is a list of ROWS; each row is a list of fields with {name, bits, syn[]}.
  // Fields marked payload:true are never quizzed (shown as fixed anchors only).

  var HEADERS = {
    tcp: {
      label: "Segment TCP",
      sizeNote: "20 a 60 bytes",
      rowBasis: 32,
      rows: [
        [
          {name:"Port origen", bits:16, syn:["port origen","puerto origen","source port","port d'origen"]},
          {name:"Port desti", bits:16, syn:["port desti","port destí","puerto destino","dest port","destination port"]}
        ],
        [
          {name:"Numero de seqüencia", bits:32, syn:["numero de secuencia","numero de seqüència","nombre de secuencia","sequence number","num seqüencia","num secuencia"]}
        ],
        [
          {name:"Numero d'acknowledgement", bits:32, syn:["numero de ack","numero d'acknowledgement","numero de reconocimiento","ack number","acknowledgement number","num ack"]}
        ],
        [
          {name:"Long. capçalera", bits:4, syn:["longitud cabecera","longitud de cabecera","data offset","offset","long capçalera","long. capçalera"]},
          {name:"Reservat", bits:6, syn:["reservado","reserved","reservat"]},
          {name:"Flags", bits:6, syn:["flags","banderas","indicadors"]},
          {name:"Finestra", bits:16, syn:["ventana","window","finestra","tamaño de ventana","mida de finestra","window size"]}
        ],
        [
          {name:"Checksum", bits:16, syn:["checksum","suma de verificacion","suma de comprovacio"]},
          {name:"Punter dades urgents", bits:16, syn:["puntero urgente","urgent pointer","punter urgent","punter dades urgents"]}
        ],
        [
          {name:"Opcions", bits:32, syn:["opciones","options","opcions"]}
        ]
      ]
    },
    udp: {
      label: "Datagrama UDP",
      sizeNote: "8 bytes",
      rowBasis: 32,
      rows: [
        [
          {name:"Port origen", bits:16, syn:["port origen","puerto origen","source port"]},
          {name:"Port desti", bits:16, syn:["port desti","port destí","puerto destino","destination port"]}
        ],
        [
          {name:"Longitud", bits:16, syn:["longitud","length","llargada"]},
          {name:"Checksum", bits:16, syn:["checksum","suma de verificacion","suma de comprovacio"]}
        ]
      ]
    },
    ip: {
      label: "Paquet IPv4",
      sizeNote: "20 a 60 bytes",
      rowBasis: 32,
      rows: [
        [
          {name:"Versio", bits:4, syn:["version","versio","versió"]},
          {name:"IHL", bits:4, syn:["ihl","longitud de cabecera internet","internet header length"]},
          {name:"ToS / DSCP", bits:8, syn:["tos","dscp","tipo de servicio","type of service","tos/dscp"]},
          {name:"Longitud total", bits:16, syn:["longitud total","total length"]}
        ],
        [
          {name:"Identificacio", bits:16, syn:["identificacion","identificació","identification"]},
          {name:"Flags", bits:3, syn:["flags","banderas","indicadors"]},
          {name:"Desplaçament", bits:13, syn:["desplazamiento","offset","fragment offset","desplaçament"]}
        ],
        [
          {name:"TTL", bits:8, syn:["ttl","time to live","temps de vida"]},
          {name:"Protocol", bits:8, syn:["protocolo","protocol"]},
          {name:"Checksum", bits:16, syn:["checksum","suma de verificacion","suma de comprovacio"]}
        ],
        [
          {name:"Adreça IP origen", bits:32, syn:["ip origen","direccion ip origen","adreça ip origen","source ip","source address"]}
        ],
        [
          {name:"Adreça IP desti", bits:32, syn:["ip destino","direccion ip destino","adreça ip desti","adreça ip destí","destination ip","destination address"]}
        ],
        [
          {name:"Opcions", bits:32, syn:["opciones","options","opcions"]}
        ]
      ]
    },
    ethernet: {
      label: "Trama Ethernet (IEEE 802.3)",
      sizeNote: "64 a 1518 bytes",
      rowBasis: null, // single row, proportional by raw bits (payload uses a representative width)
      rows: [
        [
          {name:"MAC desti", bits:48, syn:["mac destino","mac desti","mac destí","destination mac"]},
          {name:"MAC origen", bits:48, syn:["mac origen","source mac"]},
          {name:"Tipus / Longitud", bits:16, syn:["tipo","ethertype","type/length","tipus","tipus/longitud","tipo/longitud"]},
          {name:"Dades", bits:160, payload:true, note:"46-1500 bytes"},
          {name:"CRC", bits:32, syn:["crc","fcs","frame check sequence"]}
        ]
      ]
    }
  };

  var TAB_ORDER = ["tcp","udp","ip","ethernet"];
  var TAB_LABELS = {tcp:"TCP", udp:"UDP", ip:"IPv4", ethernet:"Ethernet"};

  var state = {
    current: "tcp",
    blanks: {},      // fieldKey -> true/false (is this field blanked this round)
    checked: false,
    forcedKeys: null  // when set, next practice blanks exactly these field keys (drill mode)
  };

  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---------- session totals (simple badge) ----------
  function getStats(){
    try{
      var v = localStorage.getItem('cabeceras_stats');
      return v ? JSON.parse(v) : {correct:0, attempts:0};
    }catch(e){ return {correct:0, attempts:0}; }
  }
  function saveStats(s){
    try{ localStorage.setItem('cabeceras_stats', JSON.stringify(s)); }catch(e){}
  }
  function refreshStatBadge(){
    var s = getStats();
    document.getElementById('stat-text').textContent = s.correct + ' aciertos / ' + s.attempts + ' intentos';
  }

  // ---------- per-field accuracy (spaced-repetition style weighting) ----------
  // Stored as { "tcp_0_0": {c:correctCount, w:wrongCount}, ... } across all headers.
  function getFieldStats(){
    try{
      var v = localStorage.getItem('cabeceras_field_stats');
      return v ? JSON.parse(v) : {};
    }catch(e){ return {}; }
  }
  function saveFieldStats(s){
    try{ localStorage.setItem('cabeceras_field_stats', JSON.stringify(s)); }catch(e){}
  }
  function fieldKey(headerKey, ri, fi){ return headerKey + '_' + ri + '_' + fi; }

  function recordFieldResult(headerKey, ri, fi, wasCorrect){
    var fs = getFieldStats();
    var k = fieldKey(headerKey, ri, fi);
    if(!fs[k]) fs[k] = {c:0, w:0};
    if(wasCorrect) fs[k].c++; else fs[k].w++;
    saveFieldStats(fs);
  }

  function headerAccuracy(headerKey){
    var fs = getFieldStats();
    var c = 0, w = 0;
    Object.keys(fs).forEach(function(k){
      if(k.indexOf(headerKey + '_') === 0){ c += fs[k].c; w += fs[k].w; }
    });
    if(c + w === 0) return null;
    return c / (c + w);
  }

  // ---------- fuzzy, typo-tolerant answer checking ----------
  function normalize(str){
    return str
      .toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9 /.]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function levenshtein(a, b){
    var m = a.length, n = b.length;
    if(m === 0) return n;
    if(n === 0) return m;
    var prev = new Array(n+1);
    var curr = new Array(n+1);
    for(var j=0;j<=n;j++) prev[j] = j;
    for(var i=1;i<=m;i++){
      curr[0] = i;
      for(var j2=1;j2<=n;j2++){
        var cost = a.charAt(i-1) === b.charAt(j2-1) ? 0 : 1;
        curr[j2] = Math.min(
          prev[j2] + 1,      // deletion
          curr[j2-1] + 1,    // insertion
          prev[j2-1] + cost  // substitution
        );
      }
      var tmp = prev; prev = curr; curr = tmp;
    }
    return prev[n];
  }

  // Returns {status:'exact'|'near'|'wrong', matched:string|null}
  function checkAnswer(field, userInput){
    var norm = normalize(userInput);
    if(norm === '') return {status:'wrong', matched:null};

    var candidates = [field.name].concat(field.syn || []).map(normalize);

    if(candidates.indexOf(norm) !== -1){
      return {status:'exact', matched:field.name};
    }

    // typo tolerance: allow small edit distance relative to word length
    var best = null, bestDist = Infinity;
    candidates.forEach(function(c){
      var dist = levenshtein(norm, c);
      if(dist < bestDist){ bestDist = dist; best = c; }
    });
    var allowed = Math.max(1, Math.floor(best.length * 0.22));
    if(bestDist > 0 && bestDist <= allowed){
      return {status:'near', matched:field.name};
    }
    return {status:'wrong', matched:null};
  }

  function allQuizzableFields(header){
    var list = [];
    header.rows.forEach(function(row, ri){
      row.forEach(function(f, fi){
        if(!f.payload) list.push({row:ri, idx:fi, field:f});
      });
    });
    return list;
  }

  // Weighted sampling without replacement: fields you get wrong more often,
  // and fields you've never tried, show up more; fields you've mastered fade out.
  function weightedSample(items, weights, k){
    var pool = items.map(function(it, i){ return {it:it, w:Math.max(weights[i], 0.02)}; });
    var chosen = [];
    for(var s=0; s<k && pool.length>0; s++){
      var total = pool.reduce(function(a,p){ return a+p.w; }, 0);
      var r = Math.random()*total;
      var acc = 0, idx = pool.length-1;
      for(var i=0;i<pool.length;i++){ acc += pool[i].w; if(r <= acc){ idx = i; break; } }
      chosen.push(pool[idx].it);
      pool.splice(idx, 1);
    }
    return chosen;
  }

  function pickBlanks(headerKey, header){
    var fields = allQuizzableFields(header);
    var n = fields.length;

    // drill mode: force exactly the requested weak fields
    if(state.forcedKeys){
      var forced = state.forcedKeys;
      state.forcedKeys = null;
      var map0 = {};
      forced.forEach(function(k){ map0[k] = true; });
      return map0;
    }

    var fs = getFieldStats();
    var weights = fields.map(function(f){
      var k = fieldKey(headerKey, f.row, f.idx);
      var rec = fs[k];
      if(!rec || rec.c + rec.w === 0) return 0.55; // unseen: moderate priority, keep exploring
      var acc = rec.c / (rec.c + rec.w);
      return (1 - acc) * 0.85 + 0.08; // weak fields -> closer to ~0.9, mastered -> closer to ~0.08
    });
    // small jitter so it's not 100% deterministic (keeps variety between rounds)
    weights = weights.map(function(w){ return w + Math.random()*0.25; });

    var acc = headerAccuracy(headerKey);
    var frac = acc === null ? 0.5 : Math.min(0.85, Math.max(0.35, 0.3 + acc*0.55));
    var blankCount = Math.min(n, Math.max(2, Math.round(n*frac)));

    var chosen = weightedSample(fields, weights, blankCount);
    var map = {};
    chosen.forEach(function(c){ map[c.row + '_' + c.idx] = true; });
    return map;
  }

  function renderDiagram(){
    var key = state.current;
    var header = HEADERS[key];
    var diagram = document.getElementById('diagram');
    diagram.innerHTML = '';
    diagram.className = 'diagram' + (header.rowBasis === null ? ' ethernet-mode' : '');

    document.getElementById('header-title').textContent = header.label;
    document.getElementById('header-size').textContent = header.sizeNote;

    header.rows.forEach(function(row, ri){
      var rowEl = document.createElement('div');
      rowEl.className = 'd-row' + (header.rowBasis === null ? ' single' : '');

      var basis = header.rowBasis || row.reduce(function(sum,f){ return sum + f.bits; }, 0);

      row.forEach(function(field, fi){
        var box = document.createElement('div');
        box.className = 'field';
        var grow = field.bits / basis;
        box.style.flex = grow + ' 1 0';

        var isBlank = !field.payload && state.blanks[ri + '_' + fi];

        if(field.payload){
          box.innerHTML =
            '<div class="f-label">' + field.name + '</div>' +
            '<div class="f-bits">' + (field.note || (field.bits + ' bits')) + '</div>';
        } else if(isBlank){
          box.classList.add('blank','quizzable');
          box.dataset.row = ri; box.dataset.idx = fi;
          box.innerHTML =
            '<input type="text" placeholder="?" data-row="' + ri + '" data-idx="' + fi + '" autocomplete="off" spellcheck="false">' +
            '<div class="f-bits">' + field.bits + ' bits</div>';
        } else {
          box.classList.add('quizzable');
          box.innerHTML =
            '<div class="f-label">' + field.name + '</div>' +
            '<div class="f-bits">' + field.bits + ' bits</div>';
        }

        rowEl.appendChild(box);
      });

      diagram.appendChild(rowEl);
    });

    document.getElementById('result-msg').hidden = true;
    state.checked = false;
  }

  function checkAnswers(){
    var key = state.current;
    var header = HEADERS[key];
    var inputs = document.querySelectorAll('.field.blank input');
    if(inputs.length === 0) return;

    var correctCount = 0, nearCount = 0;
    var total = inputs.length;

    inputs.forEach(function(input){
      var ri = parseInt(input.dataset.row, 10);
      var fi = parseInt(input.dataset.idx, 10);
      var field = header.rows[ri][fi];
      var box = input.closest('.field');
      var result = checkAnswer(field, input.value);

      var wasCorrect = result.status === 'exact' || result.status === 'near';
      recordFieldResult(key, ri, fi, wasCorrect);

      if(result.status === 'exact'){
        correctCount++;
        box.classList.add('correct');
        box.innerHTML = '<div class="f-label">' + field.name + '</div><div class="f-bits">' + field.bits + ' bits</div>';
      } else if(result.status === 'near'){
        correctCount++; nearCount++;
        box.classList.add('near');
        box.innerHTML = '<div class="f-label">' + field.name + '</div><div class="f-note">ortografia: casi perfecta</div>';
      } else {
        box.classList.add('wrong');
        box.innerHTML = '<div class="f-label">' + (input.value.trim() || '(vacio)') + '</div>' +
                         '<div class="f-correct">correcto: ' + field.name + '</div>';
      }
    });

    state.checked = true;

    var stats = getStats();
    stats.correct += correctCount;
    stats.attempts += total;
    saveStats(stats);
    refreshStatBadge();

    var msg = document.getElementById('result-msg');
    msg.hidden = false;
    var pct = Math.round((correctCount/total)*100);
    var nearNote = nearCount>0 ? (' (' + nearCount + ' con pequeños errores de ortografia)') : '';
    if(pct === 100){
      msg.className = 'result-msg good';
      msg.textContent = 'Perfecto: ' + correctCount + '/' + total + ' campos correctos' + nearNote + '. Dominas esta cabecera.';
      if(!reduceMotion) launchConfetti(110);
    } else if(pct >= 60){
      msg.className = 'result-msg mid';
      msg.textContent = correctCount + '/' + total + ' campos correctos' + nearNote + '. Repasa los marcados en rojo.';
    } else {
      msg.className = 'result-msg bad';
      msg.textContent = correctCount + '/' + total + ' campos correctos' + nearNote + '. Toca repasar esta cabecera con calma.';
    }

    renderWeakPanel(key, header);
  }

  function renderWeakPanel(headerKey, header){
    var fs = getFieldStats();
    var fields = allQuizzableFields(header);
    var withAcc = fields.map(function(f){
      var k = fieldKey(headerKey, f.row, f.idx);
      var rec = fs[k];
      if(!rec || rec.c + rec.w === 0) return null;
      return {field:f, key:k, acc: rec.c/(rec.c+rec.w), attempts: rec.c+rec.w};
    }).filter(function(x){ return x && x.acc < 1; });

    withAcc.sort(function(a,b){ return a.acc - b.acc; });
    var worst = withAcc.slice(0, 3);

    var panel = document.getElementById('weak-panel');
    var list = document.getElementById('weak-list');

    if(worst.length === 0){
      panel.hidden = true;
      return;
    }

    panel.hidden = false;
    list.innerHTML = '';
    worst.forEach(function(w){
      var row = document.createElement('div');
      row.className = 'weak-row';
      row.innerHTML =
        '<span class="wr-name">' + w.field.field.name + '</span>' +
        '<span class="wr-pct">' + Math.round(w.acc*100) + '% acierto</span>';
      list.appendChild(row);
    });

    document.getElementById('drill-weak-btn').onclick = function(){
      state.forcedKeys = worst.map(function(w){ return w.field.row + '_' + w.field.idx; });
      state.blanks = pickBlanks(headerKey, header);
      renderDiagram();
    };
  }

  function revealAnswers(){
    var key = state.current;
    var header = HEADERS[key];
    var inputs = document.querySelectorAll('.field.blank input');
    inputs.forEach(function(input){
      var ri = parseInt(input.dataset.row, 10);
      var fi = parseInt(input.dataset.idx, 10);
      var field = header.rows[ri][fi];
      input.value = field.name;
    });
  }

  function newPractice(){
    var key = state.current;
    var header = HEADERS[key];
    state.blanks = pickBlanks(key, header);
    renderDiagram();
    document.getElementById('weak-panel').hidden = true;
  }

  function switchTab(key){
    state.current = key;
    document.querySelectorAll('.tab-btn').forEach(function(btn){
      btn.classList.toggle('active', btn.dataset.key === key);
    });
    newPractice();
  }

  function buildTabs(){
    var tabs = document.getElementById('tabs');
    tabs.innerHTML = '';
    TAB_ORDER.forEach(function(key){
      var btn = document.createElement('button');
      btn.className = 'tab-btn' + (key === state.current ? ' active' : '');
      btn.textContent = TAB_LABELS[key];
      btn.dataset.key = key;
      btn.type = 'button';
      btn.addEventListener('click', function(){ switchTab(key); });
      tabs.appendChild(btn);
    });
  }

  // ---------- confetti (lightweight canvas burst) ----------
  function launchConfetti(count){
    var canvas = document.getElementById('confetti-canvas');
    var ctx = canvas.getContext('2d');
    var W = canvas.width = window.innerWidth;
    var H = canvas.height = window.innerHeight;
    var colors = ['#22D3EE','#4338CA','#34D399','#F59E0B','#F87171'];
    var pieces = [];
    for(var i=0;i<count;i++){
      pieces.push({
        x: Math.random()*W, y: -20 - Math.random()*H*0.3,
        r: 4 + Math.random()*5, c: colors[Math.floor(Math.random()*colors.length)],
        vy: 2 + Math.random()*3, vx: -1.5 + Math.random()*3,
        rot: Math.random()*Math.PI, vr: -0.2 + Math.random()*0.4,
        shape: Math.random() > 0.5 ? 'rect' : 'circle'
      });
    }
    var start = null, duration = 2200;
    function frame(ts){
      if(!start) start = ts;
      var elapsed = ts - start;
      ctx.clearRect(0,0,W,H);
      pieces.forEach(function(p){
        p.x += p.vx; p.y += p.vy; p.rot += p.vr;
        ctx.save(); ctx.translate(p.x,p.y); ctx.rotate(p.rot);
        ctx.fillStyle = p.c;
        if(p.shape==='rect'){ ctx.fillRect(-p.r,-p.r*0.6,p.r*2,p.r*1.2); }
        else { ctx.beginPath(); ctx.arc(0,0,p.r,0,Math.PI*2); ctx.fill(); }
        ctx.restore();
      });
      if(elapsed < duration){ requestAnimationFrame(frame); }
      else { ctx.clearRect(0,0,W,H); }
    }
    requestAnimationFrame(frame);
  }

  window.addEventListener('resize', function(){
    var c = document.getElementById('confetti-canvas');
    c.width = window.innerWidth; c.height = window.innerHeight;
  });

  document.getElementById('check-btn').addEventListener('click', checkAnswers);
  document.getElementById('reveal-btn').addEventListener('click', revealAnswers);
  document.getElementById('shuffle-btn').addEventListener('click', newPractice);

  document.getElementById('diagram').addEventListener('keydown', function(e){
    if(e.key === 'Enter'){ checkAnswers(); }
  });

  refreshStatBadge();
  buildTabs();
  newPractice();
})();
