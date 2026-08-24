// COLOQUE AQUI A URL DO SEU WEB APP DO GOOGLE APPS SCRIPT
var WEB_APP_URL = "https://script.google.com/macros/s/AKfycbztKuKgNa0zcukXRn0oJotlFQtcRiq4zLVnuJSopAefJ08dxI79LMIzUL6-XjJ1r577MQ/exec";

// ============================================================
// ESTADO DA APLICAÇÃO
// ============================================================
var Store = {
  pedidos: [],
  representantes: {},
  embarquesPorPedido: {},
  embarquesPorNome: {},
  repicPorCliente: {},
  clientes: {},
  carregado: false,
  ultimaSincronizacao: null
};

var filtroClienteCod = null;
var filtroRepCod = "TODOS";
var requisicoesPendentes = 0;

function mostrarCarregando(msg) {
  requisicoesPendentes++;
  document.getElementById('loading-texto').textContent = msg || 'Carregando...';
  document.getElementById('loading-overlay').style.display = 'flex';
}

function esconderCarregando() {
  requisicoesPendentes = Math.max(0, requisicoesPendentes - 1);
  if (requisicoesPendentes === 0) {
    document.getElementById('loading-overlay').style.display = 'none';
  }
}

function fmtMoeda(v) {
  return "R$ " + Number(v || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2});
}

function formatarData(d) {
  if (!d || isNaN(d.getTime())) return '—';
  return String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0') + '/' + d.getFullYear();
}

function chaveDia(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function normalizarNome(nome) {
  return String(nome || '')
    .toUpperCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// ============================================================
// SINCRONIZAÇÃO VIA FETCH
// ============================================================
function sincronizarDados() {
  mostrarCarregando('Sincronizando com a planilha...');
  document.getElementById('btn-sync').disabled = true;

  fetch(WEB_APP_URL)
    .then(function (response) {
      if (!response.ok) throw new Error('Erro na requisição HTTP: ' + response.status);
      return response.json();
    })
    .then(function (pacote) {
      processarPacote(pacote);
      esconderCarregando();
      document.getElementById('btn-sync').disabled = false;
    })
    .catch(function (erro) {
      esconderCarregando();
      document.getElementById('btn-sync').disabled = false;
      document.getElementById('sync-status').textContent = 'Erro ao sincronizar: ' + erro.message;
      alert('Erro ao sincronizar: ' + erro.message);
    });
}

function processarPacote(pacote) {
  if (!pacote) {
    alert("Nenhum dado recebido do servidor.");
    return;
  }
  
  if (pacote.erro) {
    alert("Erro no servidor Apps Script:\n" + pacote.erro);
    document.getElementById('sync-status').textContent = 'Erro: ' + pacote.erro;
    return;
  }

  // Converte datas em texto (DD/MM/AAAA ou ISO) para objeto Date
  function tratarData(dStr) {
    if (!dStr) return new Date();
    if (dStr instanceof Date) return dStr;
    if (typeof dStr === 'string' && dStr.includes('/')) {
      var partes = dStr.split('/');
      if (partes.length === 3) return new Date(partes[2], partes[1] - 1, partes[0]);
    }
    var dt = new Date(dStr);
    return isNaN(dt.getTime()) ? new Date() : dt;
  }

  Store.pedidos = (pacote.pedidos || []).map(function (p) {
    p.data = tratarData(p.data);
    p.valor = Number(p.valor || 0);
    return p;
  });

  Store.representantes = pacote.representantes || {};
  Store.embarquesPorPedido = pacote.embarquesPorPedido || {};
  Store.embarquesPorNome = pacote.embarquesPorNome || {};
  Store.ultimaSincronizacao = pacote.geradoEm ? tratarData(pacote.geradoEm) : new Date();
  Store.carregado = true;

  Store.repicPorCliente = calcularRepicEmMemoria(Store.pedidos);

  Store.clientes = {};
  Store.pedidos.forEach(function (p) {
    if (!Store.clientes[p.cod_cliente]) {
      Store.clientes[p.cod_cliente] = { cod: p.cod_cliente, nome: p.nome_cliente, rep: p.cod_rep };
    }
  });

  document.getElementById('sync-status').textContent =
    'Última sincronização: ' + Store.ultimaSincronizacao.toLocaleString('pt-BR');

  if (typeof montarListasBusca === 'function') montarListasBusca();
  if (typeof carregarGraficoMain === 'function') carregarGraficoMain();
}

// ============================================================
// MOTOR DE CÁLCULO
// ============================================================
function calcularRepicEmMemoria(pedidos) {
  var porCliente = {};
  pedidos.forEach(function (p) {
    if (!porCliente[p.cod_cliente]) porCliente[p.cod_cliente] = [];
    porCliente[p.cod_cliente].push(p);
  });

  var repicPorCliente = {};
  Object.keys(porCliente).forEach(function (cod) {
    var todosPedidos = porCliente[cod];

    var eventosMap = {};
    todosPedidos.forEach(function (p) {
      var dStr = chaveDia(p.data);
      if (!eventosMap[dStr]) {
        eventosMap[dStr] = { data: p.data, valorTotal: 0, rep: p.cod_rep, nome: p.nome_cliente };
      }
      eventosMap[dStr].valorTotal += p.valor;
    });

    var eventos = Object.keys(eventosMap).map(function (k) { return eventosMap[k]; })
      .sort(function (a, b) { return a.data - b.data; });

    var ultimoEvento = eventos[eventos.length - 1];
    var totalGeral = eventos.reduce(function (s, e) { return s + e.valorTotal; }, 0);
    var ticketMedio = totalGeral / eventos.length;

    var intervalos = [];
    for (var i = 1; i < eventos.length; i++) {
      intervalos.push((eventos[i].data - eventos[i - 1].data) / 86400000);
    }

    var repicMedio = intervalos.length > 0
      ? intervalos.reduce(function (s, d) { return s + d; }, 0) / intervalos.length
      : 100;

    repicPorCliente[cod] = {
      cod_cliente: cod,
      nome: ultimoEvento.nome,
      rep: ultimoEvento.rep,
      qtdCompras: eventos.length,
      ultimaCompraObj: ultimoEvento.data,
      ultimaCompra: formatarData(ultimoEvento.data),
      repicMedio: repicMedio ? Math.round(repicMedio) : null,
      proximaCompra: repicMedio ? formatarData(new Date(ultimoEvento.data.getTime() + repicMedio * 86400000)) : null,
      ticketMedio: Math.round(ticketMedio * 100) / 100,
      eventos: eventos
    };
  });
  return repicPorCliente;
}

function calcularProjecoesDoCliente(infoRepic, anoAtual) {
  if (!infoRepic || !infoRepic.eventos || infoRepic.eventos.length === 0) return [];

  var eventos = infoRepic.eventos;
  var repicMedio = (infoRepic.repicMedio && infoRepic.repicMedio >= 15) ? infoRepic.repicMedio : 365;
  var projecoes = [];

  for (var i = 0; i < eventos.length; i++) {
    var evt = eventos[i];
    var proximoEvtReal = (i + 1 < eventos.length) ? eventos[i + 1] : null;
    var dataPrev = new Date(evt.data.getTime() + repicMedio * 86400000);

    if (dataPrev.getFullYear() !== anoAtual) continue;

    var mesDevido = dataPrev.getMonth() + 1;
    var comprouNoMes = false;
    var mesResolucao = null;

    if (proximoEvtReal) {
      if (proximoEvtReal.data < dataPrev) {
        comprouNoMes = true;
      } else {
        var mesReal = proximoEvtReal.data.getMonth() + 1;
        var anoReal = proximoEvtReal.data.getFullYear();
        if (anoReal === anoAtual && mesReal === mesDevido) {
          comprouNoMes = true;
        } else {
          mesResolucao = (anoReal === anoAtual) ? mesReal : 13;
        }
      }
    }

    projecoes.push({
      dataPrevistaObj: dataPrev,
      dataPrevista: formatarData(dataPrev),
      mes: mesDevido,
      comprouNoMes: comprouNoMes,
      mesResolucao: mesResolucao,
      ticketMedio: infoRepic.ticketMedio
    });
  }

  return projecoes;
}
