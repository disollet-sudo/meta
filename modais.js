function abrirModal(codCliente) {
  document.getElementById('modal-cliente').style.display = 'flex';

  var r = Store.repicPorCliente[codCliente] || null;
  var pedidosCliente = Store.pedidos.filter(function (p) { return String(p.cod_cliente) === String(codCliente); })
    .sort(function (a, b) { return b.data - a.data; });
  var totalGeral = pedidosCliente.reduce(function (s, p) { return s + p.valor; }, 0);

  document.getElementById('modal-nome-cliente').textContent = r ? r.nome : "Cliente " + codCliente;

  var repicTexto = '—';
  if (r && r.repicMedio) {
    repicTexto = r.repicMedio + ' dias' + (r.repicEstimado ? ' (estimado)' : '');
  }

  var html = '<div class="stats-grid">' +
    '<div class="stat-box"><span>Representante</span><b>' + (r ? r.rep : '—') + '</b></div>' +
    '<div class="stat-box"><span>Repic Médio</span><b>' + repicTexto + '</b></div>' +
    '<div class="stat-box"><span>Ticket Médio</span><b>' + (r ? fmtMoeda(r.ticketMedio) : '—') + '</b></div>' +
    '<div class="stat-box"><span>Total Comprado</span><b>' + fmtMoeda(Math.round(totalGeral * 100) / 100) + '</b></div>' +
    '<div class="stat-box"><span>Última Compra</span><b>' + (r ? r.ultimaCompra : '—') + '</b></div>' +
    '<div class="stat-box"><span>Próxima Prevista</span><b>' + (r && r.proximaCompra ? r.proximaCompra : '—') + '</b></div>' +
    '</div>';

  html += '<h4 style="margin: 12px 0 6px 0; font-size: 13px;">Histórico de Pedidos</h4>';
  html += '<table><thead><tr><th>Pedido</th><th>Data</th><th>Rep</th><th>Valor</th></tr></thead><tbody>';
  pedidosCliente.forEach(function (p) {
    html += '<tr><td>' + p.num_pedido + '</td><td>' + formatarData(p.data) + '</td><td>' + p.cod_rep + '</td><td>' + fmtMoeda(p.valor) + '</td></tr>';
  });
  html += '</tbody></table>';

  document.getElementById('modal-conteudo').innerHTML = html;
}

function fecharModal() {
  document.getElementById('modal-cliente').style.display = 'none';
}

// ============================================================
// ORDENAÇÃO CLICÁVEL + CABEÇALHO FIXO (Pendentes e Inativos)
// ============================================================
var EstadoOrdenacao = {
  pendentes: { campo: 'diasAtraso', direcao: 'desc' },
  inativos: { campo: 'diasEmbarque', direcao: 'desc' }
};

var FiltroStatus = {
  pendentes: 'todos', // todos | leve | moderado | severo
  inativos: 'todos'   // todos | pre | hoje | inativou
};

// Estilo aplicado a todo <th>: fixa o cabeçalho no topo ao rolar a tabela.
var TH_STICKY_STYLE = 'position:sticky; top:0; background:#f7f7f7; z-index:2; box-shadow: 0 1px 0 #ddd;';

function compararValores(va, vb) {
  if (va === vb) return 0;
  if (va === null || va === undefined) return -1;
  if (vb === null || vb === undefined) return 1;
  if (typeof va === 'string') return va.localeCompare(vb, 'pt-BR', { sensitivity: 'base' });
  return va - vb; // números e datas (Date - Date funciona nativamente)
}

function thOrdenavel(estado, campo, label, onClickFn) {
  var seta = estado.campo === campo ? (estado.direcao === 'asc' ? ' \u25B2' : ' \u25BC') : '';
  return '<th style="' + TH_STICKY_STYLE + ' cursor:pointer; user-select:none;" title="Clique para ordenar" onclick="' + onClickFn + '(\'' + campo + '\')">' + label + seta + '</th>';
}

function thFixo(label) {
  return '<th style="' + TH_STICKY_STYLE + '">' + label + '</th>';
}

// ============================================================
// PENDENTES
// ============================================================
var CachePendentes = [];

function bucketPendente(diasAtraso) {
  if (diasAtraso <= 15) return 'leve';
  if (diasAtraso <= 30) return 'moderado';
  return 'severo';
}

function abrirPendentes() {
  document.getElementById('modal-pendentes').style.display = 'flex';

  var hoje = new Date();
  var pendentes = [];

  Object.keys(Store.repicPorCliente).forEach(function (codCliente) {
    if (filtroClienteCod && String(codCliente) !== String(filtroClienteCod)) return;
    var info = Store.repicPorCliente[codCliente];
    if (filtroRepCod && filtroRepCod !== "TODOS" && String(info.rep) !== String(filtroRepCod)) return;

    var repicMedio = (info.repicMedio && info.repicMedio >= 15) ? info.repicMedio : REPIC_PADRAO_CLIENTE_NOVO;
    var proximaEsperadaObj = new Date(info.ultimaCompraObj.getTime() + repicMedio * 86400000);

    if (proximaEsperadaObj < hoje) {
      var diasAtraso = Math.floor((hoje - proximaEsperadaObj) / 86400000);
      pendentes.push({
        cod_cliente: codCliente, nome: info.nome, rep: info.rep,
        dataPrevistaObj: proximaEsperadaObj, dataPrevista: formatarData(proximaEsperadaObj),
        valorEsperado: info.ticketMedio, diasAtraso: diasAtraso
      });
    }
  });

  CachePendentes = pendentes;
  renderizarTabelaPendentes();
}

function ordenarPendentesPor(campo) {
  var est = EstadoOrdenacao.pendentes;
  if (est.campo === campo) { est.direcao = est.direcao === 'asc' ? 'desc' : 'asc'; }
  else { est.campo = campo; est.direcao = 'asc'; }
  renderizarTabelaPendentes();
}

function filtrarPendentesPorStatus(valor) {
  FiltroStatus.pendentes = valor;
  renderizarTabelaPendentes();
}

function renderizarTabelaPendentes() {
  var est = EstadoOrdenacao.pendentes;
  var filtro = FiltroStatus.pendentes;

  var lista = CachePendentes.filter(function (p) {
    return filtro === 'todos' || bucketPendente(p.diasAtraso) === filtro;
  }).sort(function (a, b) {
    var cmp = compararValores(a[est.campo], b[est.campo]);
    return est.direcao === 'asc' ? cmp : -cmp;
  });

  var totalPendente = lista.reduce(function (s, p) { return s + p.valorEsperado; }, 0);

  var html = '<div class="stats-grid cols-3">' +
    '<div class="stat-box"><span>Qtd. Pendentes</span><b>' + lista.length + '</b></div>' +
    '<div class="stat-box"><span>Total Pendente</span><b>' + fmtMoeda(Math.round(totalPendente * 100) / 100) + '</b></div>' +
    '<div class="stat-box"><span>Ordenado por</span><b>Clique nas colunas</b></div></div>';

  html += '<div style="margin:10px 0;">' +
    '<label style="font-size:12px; color:#555; margin-right:6px;">Filtrar por status:</label>' +
    '<select onchange="filtrarPendentesPorStatus(this.value)">' +
    '<option value="todos"' + (filtro === 'todos' ? ' selected' : '') + '>Todos</option>' +
    '<option value="leve"' + (filtro === 'leve' ? ' selected' : '') + '>Atraso leve (até 15 dias)</option>' +
    '<option value="moderado"' + (filtro === 'moderado' ? ' selected' : '') + '>Atraso moderado (16–30 dias)</option>' +
    '<option value="severo"' + (filtro === 'severo' ? ' selected' : '') + '>Atraso severo (31+ dias)</option>' +
    '</select></div>';

  html += '<div style="max-height:60vh; overflow-y:auto;">';
  html += '<table><thead><tr>' +
    thOrdenavel(est, 'nome', 'Cliente', 'ordenarPendentesPor') +
    thOrdenavel(est, 'rep', 'Rep', 'ordenarPendentesPor') +
    thOrdenavel(est, 'dataPrevistaObj', 'Previsto para', 'ordenarPendentesPor') +
    thOrdenavel(est, 'valorEsperado', 'Valor Esperado', 'ordenarPendentesPor') +
    thOrdenavel(est, 'diasAtraso', 'Dias Atraso', 'ordenarPendentesPor') +
    '</tr></thead><tbody>';

  if (lista.length === 0) html += '<tr><td colspan="5" style="text-align:center; color:#999;">Nenhum cliente pendente com esse filtro 🎉</td></tr>';
  lista.forEach(function (p) {
    html += '<tr class="row-click" onclick="fecharPendentesEAbrirCliente(\'' + p.cod_cliente + '\')">' +
      '<td>' + p.nome + '</td><td>' + p.rep + '</td><td>' + p.dataPrevista + '</td>' +
      '<td>' + fmtMoeda(p.valorEsperado) + '</td>' +
      '<td style="color:#c5221f; font-weight:700;">' + p.diasAtraso + ' dias</td></tr>';
  });
  html += '</tbody></table></div>';

  document.getElementById('pendentes-conteudo').innerHTML = html;
}

function fecharPendentes() { document.getElementById('modal-pendentes').style.display = 'none'; }
function fecharPendentesEAbrirCliente(cod) { fecharPendentes(); abrirModal(cod); }

// ============================================================
// INATIVOS / PRÉ-INATIVOS
// Regra fixa (igual pra todos os clientes, sem usar repic individual):
//   - a partir de 80 dias desde o embarque do último pedido -> aviso
//     "Inativa em N dia(s)" contando até 90
//   - aos 90 dias -> "Inativa HOJE"
//   - acima de 90 dias -> "Já inativou! Pode vender"
// ============================================================
var CacheInativos = [];
var INATIVOS_AVISO_A_PARTIR_DE = 80;
var INATIVOS_INATIVOU_EM = 90;

function statusInativo(p) {
  if (p.diasEmbarque < INATIVOS_INATIVOU_EM) {
    var diasRestantes = INATIVOS_INATIVOU_EM - p.diasEmbarque;
    return {
      bucket: 'pre',
      badgeColor: p.diasEmbarque >= (INATIVOS_INATIVOU_EM - 3) ? '#c5221f' : '#b06000',
      texto: 'Inativa em ' + diasRestantes + ' dia(s)'
    };
  } else if (p.diasEmbarque === INATIVOS_INATIVOU_EM) {
    return { bucket: 'hoje', badgeColor: '#c5221f', texto: 'Inativa HOJE' };
  }
  return { bucket: 'inativou', badgeColor: '#137333', texto: 'Já inativou! Pode vender' };
}

function abrirInativos() {
  document.getElementById('modal-inativos').style.display = 'flex';

  var clientesUltimoPedido = {};
  getPedidosFiltrados().forEach(function (p) {
    var chave = p.cod_cliente;
    if (!chave) return;
    if (!clientesUltimoPedido[chave] || p.data > clientesUltimoPedido[chave].data) {
      clientesUltimoPedido[chave] = p;
    }
  });

  var hoje = new Date();
  var resultado = [];

  Object.keys(clientesUltimoPedido).forEach(function (codCli) {
    var ultPed = clientesUltimoPedido[codCli];

    var dataPorPedido = Store.embarquesPorPedido[ultPed.num_pedido] || null;
    var dataPorNome = Store.embarquesPorNome[normalizarNome(ultPed.nome_cliente)] || null;

    var dataEmbarque = null, origem = null;
    if (dataPorPedido && dataPorNome) {
      if (dataPorPedido.getTime() >= dataPorNome.getTime()) { dataEmbarque = dataPorPedido; origem = 'pedido'; }
      else { dataEmbarque = dataPorNome; origem = 'nome'; }
    } else if (dataPorPedido) { dataEmbarque = dataPorPedido; origem = 'pedido'; }
    else if (dataPorNome) { dataEmbarque = dataPorNome; origem = 'nome'; }

    if (dataEmbarque) {
      var diasEmbarque = Math.floor((hoje.getTime() - dataEmbarque.getTime()) / 86400000);
      if (diasEmbarque >= INATIVOS_AVISO_A_PARTIR_DE) {
        resultado.push({
          cod_cliente: ultPed.cod_cliente, nome: ultPed.nome_cliente, rep: ultPed.cod_rep,
          num_pedido: ultPed.num_pedido,
          dataEmbarqueObj: dataEmbarque, dataEmbarque: formatarData(dataEmbarque),
          diasEmbarque: diasEmbarque, origemData: origem
        });
      }
    }
  });

  CacheInativos = resultado;
  renderizarTabelaInativos();
}

function ordenarInativosPor(campo) {
  var est = EstadoOrdenacao.inativos;
  if (est.campo === campo) { est.direcao = est.direcao === 'asc' ? 'desc' : 'asc'; }
  else { est.campo = campo; est.direcao = 'asc'; }
  renderizarTabelaInativos();
}

function filtrarInativosPorStatus(valor) {
  FiltroStatus.inativos = valor;
  renderizarTabelaInativos();
}

function renderizarTabelaInativos() {
  var est = EstadoOrdenacao.inativos;
  var filtro = FiltroStatus.inativos;

  var lista = CacheInativos.filter(function (p) {
    return filtro === 'todos' || statusInativo(p).bucket === filtro;
  }).sort(function (a, b) {
    var cmp = compararValores(a[est.campo], b[est.campo]);
    return est.direcao === 'asc' ? cmp : -cmp;
  });

  var html = '<div class="stats-grid cols-3">' +
    '<div class="stat-box"><span>Qtd. Registros</span><b>' + lista.length + '</b></div>' +
    '<div class="stat-box"><span>Filtro</span><b>>= 80 dias de embarque</b></div>' +
    '<div class="stat-box"><span>Ordenado por</span><b>Clique nas colunas</b></div></div>';

  html += '<div style="margin:10px 0;">' +
    '<label style="font-size:12px; color:#555; margin-right:6px;">Filtrar por status:</label>' +
    '<select onchange="filtrarInativosPorStatus(this.value)">' +
    '<option value="todos"' + (filtro === 'todos' ? ' selected' : '') + '>Todos</option>' +
    '<option value="pre"' + (filtro === 'pre' ? ' selected' : '') + '>Pré-inativo (vai inativar)</option>' +
    '<option value="hoje"' + (filtro === 'hoje' ? ' selected' : '') + '>Inativa hoje</option>' +
    '<option value="inativou"' + (filtro === 'inativou' ? ' selected' : '') + '>Já inativou</option>' +
    '</select></div>';

  html += '<div style="max-height:60vh; overflow-y:auto;">';
  html += '<table><thead><tr>' +
    thOrdenavel(est, 'nome', 'Cliente', 'ordenarInativosPor') +
    thOrdenavel(est, 'rep', 'Rep', 'ordenarInativosPor') +
    thOrdenavel(est, 'num_pedido', 'Últ. Pedido', 'ordenarInativosPor') +
    thOrdenavel(est, 'dataEmbarqueObj', 'Data Embarque', 'ordenarInativosPor') +
    thOrdenavel(est, 'diasEmbarque', 'Dias Embarcado', 'ordenarInativosPor') +
    thFixo('Status') +
    '</tr></thead><tbody>';

  if (lista.length === 0) html += '<tr><td colspan="6" style="text-align:center; color:#999;">Nenhum cliente com esse filtro 🎉</td></tr>';

  lista.forEach(function (p) {
    var st = statusInativo(p);
    html += '<tr class="row-click" onclick="fecharInativosEAbrirCliente(\'' + p.cod_cliente + '\')">' +
      '<td>' + p.nome + '</td><td>' + p.rep + '</td><td>' + p.num_pedido + '</td>' +
      '<td>' + p.dataEmbarque + '</td><td><b>' + p.diasEmbarque + ' dias</b></td>' +
      '<td><span style="color:' + st.badgeColor + '; font-weight:700;">' + st.texto + '</span></td></tr>';
  });
  html += '</tbody></table></div>';

  document.getElementById('inativos-conteudo').innerHTML = html;
}

function fecharInativos() { document.getElementById('modal-inativos').style.display = 'none'; }
function fecharInativosEAbrirCliente(cod) { fecharInativos(); abrirModal(cod); }
