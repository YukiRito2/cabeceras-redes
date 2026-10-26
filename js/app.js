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
    totalAttempts: 0,
    totalCorrect: 0
  };

  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

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

  function normalize(str){
    return str
      .toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9 /.]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function isAnswerCorrect(field, userInput){
    var norm = normalize(userInput);
    if(norm === '') return false;
    var candidates = [field.name].concat(field.syn || []).map(normalize);
    return candidates.indexOf(norm) !== -1;
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

  function pickBlanks(header){
    var fields = allQuizzableFields(header);
    var n = fields.length;
    var blankCount = Math.max(2, Math.round(n * (0.55 + Math.random()*0.2)));
    blankCount = Math.min(blankCount, n);
    var shuffled = fields.slice().sort(function(){ return Math.random()-0.5; });
    var chosen = shuffled.slice(0, blankCount);
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

    var correctCount = 0;
    var total = inputs.length;

    inputs.forEach(function(input){
      var ri = parseInt(input.dataset.row, 10);
      var fi = parseInt(input.dataset.idx, 10);
      var field = header.rows[ri][fi];
      var box = input.closest('.field');
      var ok = isAnswerCorrect(field, input.value);
      if(ok){
        correctCount++;
        box.classList.add('correct');
        box.innerHTML = '<div class="f-label">' + field.name + '</div><div class="f-bits">' + field.bits + ' bits</div>';
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
    if(pct === 100){
      msg.className = 'result-msg good';
      msg.textContent = 'Perfecto: ' + correctCount + '/' + total + ' campos correctos. Dominas esta cabecera.';
      if(!reduceMotion) launchConfetti(110);
    } else if(pct >= 60){
      msg.className = 'result-msg mid';
      msg.textContent = correctCount + '/' + total + ' campos correctos. Repasa los marcados en rojo.';
    } else {
      msg.className = 'result-msg bad';
      msg.textContent = correctCount + '/' + total + ' campos correctos. Toca repasar esta cabecera con calma.';
    }
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
    var header = HEADERS[state.current];
    state.blanks = pickBlanks(header);
    renderDiagram();
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
