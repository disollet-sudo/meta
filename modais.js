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
// ORDENAÇÃO CLICÁVEL (Pendentes e Inativos)
// ============================================================
var EstadoOrdenacao = {
  pendentes: { campo: 'diasAtraso', direcao: 'desc' },
  inativos: { campo: 'diasEmbarque', direcao: 'desc' }
};

function compararValores(va, vb) {
  if (va === vb) return 0;
  if (va === null || va === undefined) return -1;
  if (vb === null || vb === undefined) return 1;
  if (typeof va === 'string') return va.localeCompare(vb, 'pt-BR', { sensitivity: 'base' });
  return va - vb; // números e datas (Date - Date funciona nativamente)
}

function thOrdenavel(estado, campo, label, onClickFn) {
  var seta = estado.campo === campo ? (estado.direcao === 'asc' ? ' \u25B2' : ' \u25BC') : '';
  return '<th class="th-sort" style="cursor:pointer; user-select:none;" title="Clique para ordenar" onclick="' + onClickFn + '(\'' + campo + '\')">' + label + seta + '</th>';
}

// ============================================================
// PENDENTES
// ============================================================
var CachePendentes = [];

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

function renderizarTabelaPendentes() {
  var est = EstadoOrdenacao.pendentes;
  var lista = CachePendentes.slice().sort(function (a, b) {
    var cmp = compararValores(a[est.campo], b[est.campo]);
    return est.direcao === 'asc' ? cmp : -cmp;
  });

  var totalPendente = lista.reduce(function (s, p) { return s + p.valorEsperado; }, 0);

  var html = '<div class="stats-grid cols-3">' +
    '<div class="stat-box"><span>Qtd. Pendentes</span><b>' + lista.length + '</b></div>' +
    '<div class="stat-box"><span>Total Pendente</span><b>' + fmtMoeda(Math.round(totalPendente * 100) / 100) + '</b></div>' +
    '<div class="stat-box"><span>Ordenado por</span><b>Clique nas colunas</b></div></div>';

  html += '<table><thead><tr>' +
    thOrdenavel(est, 'nome', 'Cliente', 'ordenarPendentesPor') +
    thOrdenavel(est, 'rep', 'Rep', 'ordenarPendentesPor') +
    thOrdenavel(est, 'dataPrevistaObj', 'Previsto para', 'ordenarPendentesPor') +
    thOrdenavel(est, 'valorEsperado', 'Valor Esperado', 'ordenarPendentesPor') +
    thOrdenavel(est, 'diasAtraso', 'Dias Atraso', 'ordenarPendentesPor') +
    '</tr></thead><tbody>';

  if (lista.length === 0) html += '<tr><td colspan="5" style="text-align:center; color:#999;">Nenhum cliente pendente no momento 🎉</td></tr>';
  lista.forEach(function (p) {
    html += '<tr class="row-click" onclick="fecharPendentesEAbrirCliente(\'' + p.cod_cliente + '\')">' +
      '<td>' + p.nome + '</td><td>' + p.rep + '</td><td>' + p.dataPrevista + '</td>' +
      '<td>' + fmtMoeda(p.valorEsperado) + '</td>' +
      '<td style="color:#c5221f; font-weight:700;">' + p.diasAtraso + ' dias</td></tr>';
  });
  html += '</tbody></table>';

  document.getElementById('pendentes-conteudo').innerHTML = html;
}

function fecharPendentes() { document.getElementById('modal-pendentes').style.display = 'none'; }
function fecharPendentesEAbrirCliente(cod) { fecharPendentes(); abrirModal(cod); }

// ============================================================
// INATIVOS / PRÉ-INATIVOS
// ============================================================
var CacheInativos = [];

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
    var infoRepic = Store.repicPorCliente[codCli];
    if (!infoRepic) return;

    // Repic individual do cliente — cliente novo (sem 2º pedido) usa o
    // padrão global de 120 dias; os demais usam a média real dos intervalos.
    var repic = (infoRepic.repicMedio && infoRepic.repicMedio >= 15) ? infoRepic.repicMedio : REPIC_PADRAO_CLIENTE_NOVO;
    var avisoApartirDe = Math.max(repic - 10, 0); // janela de aviso: 10 dias antes do repic estourar

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
      if (diasEmbarque >= avisoApartirDe) {
        resultado.push({
          cod_cliente: ultPed.cod_cliente, nome: ultPed.nome_cliente, rep: ultPed.cod_rep,
          num_pedido: ultPed.num_pedido,
          dataEmbarqueObj: dataEmbarque, dataEmbarque: formatarData(dataEmbarque),
          diasEmbarque: diasEmbarque, origemData: origem, repic: repic
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

function renderizarTabelaInativos() {
  var est = EstadoOrdenacao.inativos;
  var lista = CacheInativos.slice().sort(function (a, b) {
    var cmp = compararValores(a[est.campo], b[est.campo]);
    return est.direcao === 'asc' ? cmp : -cmp;
  });

  var html = '<div class="stats-grid cols-3">' +
    '<div class="stat-box"><span>Qtd. Registros</span><b>' + lista.length + '</b></div>' +
    '<div class="stat-box"><span>Filtro</span><b>Repic individual − 10 dias</b></div>' +
    '<div class="stat-box"><span>Ordenado por</span><b>Clique nas colunas</b></div></div>';

  html += '<table><thead><tr>' +
    thOrdenavel(est, 'nome', 'Cliente', 'ordenarInativosPor') +
    thOrdenavel(est, 'rep', 'Rep', 'ordenarInativosPor') +
    thOrdenavel(est, 'num_pedido', 'Últ. Pedido', 'ordenarInativosPor') +
    thOrdenavel(est, 'dataEmbarqueObj', 'Data Embarque', 'ordenarInativosPor') +
    thOrdenavel(est, 'repic', 'Repic', 'ordenarInativosPor') +
    thOrdenavel(est, 'diasEmbarque', 'Dias Embarcado', 'ordenarInativosPor') +
    '<th>Status</th></tr></thead><tbody>';

  if (lista.length === 0) html += '<tr><td colspan="7" style="text-align:center; color:#999;">Nenhum cliente próximo de inativar 🎉</td></tr>';

  lista.forEach(function (p) {
    var badgeColor, txtStatus;
    if (p.diasEmbarque < p.repic) {
      var diasRestantes = p.repic - p.diasEmbarque;
      badgeColor = diasRestantes <= 3 ? '#c5221f' : '#b06000';
      txtStatus = 'Inativa em ' + diasRestantes + ' dia(s)';
    } else if (p.diasEmbarque === p.repic) {
      badgeColor = '#c5221f'; txtStatus = 'Inativa HOJE';
    } else {
      badgeColor = '#137333'; txtStatus = 'Já inativou! Pode vender';
    }

    html += '<tr class="row-click" onclick="fecharInativosEAbrirCliente(\'' + p.cod_cliente + '\')">' +
      '<td>' + p.nome + '</td><td>' + p.rep + '</td><td>' + p.num_pedido + '</td>' +
      '<td>' + p.dataEmbarque + '</td><td>' + p.repic + ' dias</td><td><b>' + p.diasEmbarque + ' dias</b></td>' +
      '<td><span style="color:' + badgeColor + '; font-weight:700;">' + txtStatus + '</span></td></tr>';
  });
  html += '</tbody></table>';

  document.getElementById('inativos-conteudo').innerHTML = html;
}

function fecharInativos() { document.getElementById('modal-inativos').style.display = 'none'; }
function fecharInativosEAbrirCliente(cod) { fecharInativos(); abrirModal(cod); }
