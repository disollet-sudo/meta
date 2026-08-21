function abrirModal(codCliente) {
  document.getElementById('modal-cliente').style.display = 'flex';

  var r = Store.repicPorCliente[codCliente] || null;
  var pedidosCliente = Store.pedidos.filter(function (p) { return String(p.cod_cliente) === String(codCliente); })
    .sort(function (a, b) { return b.data - a.data; });
  var totalGeral = pedidosCliente.reduce(function (s, p) { return s + p.valor; }, 0);

  document.getElementById('modal-nome-cliente').textContent = r ? r.nome : "Cliente " + codCliente;

  var html = '<div class="stats-grid">' +
    '<div class="stat-box"><span>Representante</span><b>' + (r ? r.rep : '—') + '</b></div>' +
    '<div class="stat-box"><span>Repic Médio</span><b>' + (r && r.repicMedio ? r.repicMedio + ' dias' : '—') + '</b></div>' +
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

function abrirPendentes() {
  document.getElementById('modal-pendentes').style.display = 'flex';

  var hoje = new Date();
  var pendentes = [];
  var totalPendente = 0;

  Object.keys(Store.repicPorCliente).forEach(function (codCliente) {
    if (filtroClienteCod && String(codCliente) !== String(filtroClienteCod)) return;
    var info = Store.repicPorCliente[codCliente];
    if (filtroRepCod && filtroRepCod !== "TODOS" && String(info.rep) !== String(filtroRepCod)) return;

    var repicMedio = (info.repicMedio && info.repicMedio >= 15) ? info.repicMedio : 365;
    var proximaEsperadaObj = new Date(info.ultimaCompraObj.getTime() + repicMedio * 86400000);

    if (proximaEsperadaObj < hoje) {
      var diasAtraso = Math.floor((hoje - proximaEsperadaObj) / 86400000);
      pendentes.push({
        cod_cliente: codCliente, nome: info.nome, rep: info.rep,
        dataPrevista: formatarData(proximaEsperadaObj), valorEsperado: info.ticketMedio, diasAtraso: diasAtraso
      });
      totalPendente += info.ticketMedio;
    }
  });

  pendentes.sort(function (a, b) { return b.diasAtraso - a.diasAtraso; });

  var html = '<div class="stats-grid cols-3">' +
    '<div class="stat-box"><span>Qtd. Pendentes</span><b>' + pendentes.length + '</b></div>' +
    '<div class="stat-box"><span>Total Pendente</span><b>' + fmtMoeda(Math.round(totalPendente * 100) / 100) + '</b></div>' +
    '<div class="stat-box"><span>Ordenado por</span><b>Mais atrasado primeiro</b></div></div>';

  html += '<table><thead><tr><th>Cliente</th><th>Rep</th><th>Previsto para</th><th>Valor Esperado</th><th>Dias Atraso</th></tr></thead><tbody>';
  if (pendentes.length === 0) html += '<tr><td colspan="5" style="text-align:center; color:#999;">Nenhum cliente pendente no momento 🎉</td></tr>';
  pendentes.forEach(function (p) {
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
      if (diasEmbarque >= 80) {
        resultado.push({
          cod_cliente: ultPed.cod_cliente, nome: ultPed.nome_cliente, rep: ultPed.cod_rep,
          num_pedido: ultPed.num_pedido, dataEmbarque: formatarData(dataEmbarque),
          diasEmbarque: diasEmbarque, origemData: origem
        });
      }
    }
  });

  resultado.sort(function (a, b) { return b.diasEmbarque - a.diasEmbarque; });

  var html = '<div class="stats-grid cols-3">' +
    '<div class="stat-box"><span>Qtd. Registros</span><b>' + resultado.length + '</b></div>' +
    '<div class="stat-box"><span>Filtro</span><b>>= 80 dias de embarque</b></div>' +
    '<div class="stat-box"><span>Ordenado por</span><b>Mais tempo de embarque</b></div></div>';

  html += '<table><thead><tr><th>Cliente</th><th>Rep</th><th>Últ. Pedido</th><th>Data Embarque</th><th>Dias Embarcado</th><th>Status</th></tr></thead><tbody>';
  if (resultado.length === 0) html += '<tr><td colspan="6" style="text-align:center; color:#999;">Nenhum cliente a partir de 80 dias de embarque 🎉</td></tr>';

  resultado.forEach(function (p) {
    var badgeColor, txtStatus;
    if (p.diasEmbarque < 90) {
      var diasRestantes = 90 - p.diasEmbarque;
      badgeColor = p.diasEmbarque >= 87 ? '#c5221f' : '#b06000';
      txtStatus = 'Inativa em ' + diasRestantes + ' dia(s)';
    } else if (p.diasEmbarque === 90) {
      badgeColor = '#c5221f'; txtStatus = 'Inativa HOJE';
    } else {
      badgeColor = '#137333'; txtStatus = 'Já inativou! Pode vender';
    }

    html += '<tr class="row-click" onclick="fecharInativosEAbrirCliente(\'' + p.cod_cliente + '\')">' +
      '<td>' + p.nome + '</td><td>' + p.rep + '</td><td>' + p.num_pedido + '</td>' +
      '<td>' + p.dataEmbarque + '</td><td><b>' + p.diasEmbarque + ' dias</b></td>' +
      '<td><span style="color:' + badgeColor + '; font-weight:700;">' + txtStatus + '</span></td></tr>';
  });
  html += '</tbody></table>';

  document.getElementById('inativos-conteudo').innerHTML = html;
}

function fecharInativos() { document.getElementById('modal-inativos').style.display = 'none'; }
function fecharInativosEAbrirCliente(cod) { fecharInativos(); abrirModal(cod); }
