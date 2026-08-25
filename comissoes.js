// ============================================================
// COMISSOES.JS - TELA DE COMISSÕES (navegação, filtros, tabelas, modal,
// metas mensais por representante e comissão fixa temporária)
// ============================================================

var filtroRepComissao = "TODOS";
var filtroClienteComissao = null;
var filtroStatusComissao = "TODOS";
var filtroPeriodoComissao = "TODOS";
var visaoComissao = "REP";
var modalRepCodAtual = null;

// Regras de comissão por atingimento de meta:
// até a meta (100%)     -> 5%
// >= 10% acima da meta  -> 7%
// >= 20% acima da meta  -> 10%
function calcularComissaoEsperada(vendido, meta) {
  if (!meta || meta <= 0) return null;
  var atingimento = vendido / meta;
  if (atingimento >= 1.20) return 10;
  if (atingimento >= 1.10) return 7;
  return 5;
}

// ============================================================
// NAVEGAÇÃO ENTRE TELAS
// ============================================================
function irParaPainel() {
  document.getElementById('tela-painel').style.display = '';
  document.getElementById('tela-comissoes').style.display = 'none';
  document.getElementById('nav-painel').classList.add('active');
  document.getElementById('nav-comissoes').classList.remove('active');
}

function irParaComissoes() {
  document.getElementById('tela-painel').style.display = 'none';
  document.getElementById('tela-comissoes').style.display = '';
  document.getElementById('nav-comissoes').classList.add('active');
  document.getElementById('nav-painel').classList.remove('active');
  if (Store.carregado) renderizarComissoes();
}

// ============================================================
// BUSCA / AUTOCOMPLETE (reaproveita criarAutocomplete de busca.js)
// ============================================================
function montarListasBuscaComissao() {
  var repsMap = {};
  Store.comissoes.forEach(function (c) {
    if (c.cod_rep) repsMap[c.cod_rep] = c.nome_rep || ('Rep ' + c.cod_rep);
  });
  var repsArray = Object.keys(repsMap).map(function (cod) {
    return { cod: cod, nome: repsMap[cod] };
  }).sort(function (a, b) { return a.nome.localeCompare(b.nome); });

  var clientesMap = {};
  Store.comissoes.forEach(function (c) {
    if (c.cod_cliente) clientesMap[c.cod_cliente] = c.nome_cliente || ('Cliente ' + c.cod_cliente);
  });
  var clientesArray = Object.keys(clientesMap).map(function (cod) {
    return { cod: cod, nome: clientesMap[cod] };
  }).sort(function (a, b) { return a.nome.localeCompare(b.nome); });

  criarAutocomplete('busca-rep-comissao', 'lista-reps-comissao', repsArray.map(function (r) {
    return { valor: r.cod, texto: r.cod + ' - ' + r.nome };
  }), function (item) {
    filtroRepComissao = item ? item.valor : "TODOS";
    document.getElementById('busca-rep-comissao').value = item ? item.texto : '';
    renderizarComissoes();
  });

  criarAutocomplete('busca-cliente-comissao', 'lista-clientes-comissao', clientesArray.map(function (c) {
    return { valor: c.cod, texto: c.cod + ' - ' + c.nome };
  }), function (item) {
    filtroClienteComissao = item ? item.valor : null;
    document.getElementById('busca-cliente-comissao').value = item ? item.texto : '';
    renderizarComissoes();
  });
}

function limparFiltrosComissao() {
  document.getElementById('busca-rep-comissao').value = "";
  document.getElementById('busca-cliente-comissao').value = "";
  filtroRepComissao = "TODOS";
  filtroClienteComissao = null;
  filtroStatusComissao = "TODOS";
  filtroPeriodoComissao = "TODOS";

  document.querySelectorAll('.chip-status').forEach(function (b) { b.classList.remove('active'); });
  document.getElementById('chip-status-todos').classList.add('active');

  document.querySelectorAll('.chip-periodo').forEach(function (b) { b.classList.remove('active'); });
  document.getElementById('chip-periodo-todos').classList.add('active');

  renderizarComissoes();
}

// ============================================================
// CHIPS (status / período / visão)
// ============================================================
function setStatusComissao(status, btnEl) {
  filtroStatusComissao = status;
  document.querySelectorAll('.chip-status').forEach(function (b) { b.classList.remove('active'); });
  btnEl.classList.add('active');
  renderizarComissoes();
}

function setPeriodoComissao(periodo, btnEl) {
  filtroPeriodoComissao = periodo;
  document.querySelectorAll('.chip-periodo').forEach(function (b) { b.classList.remove('active'); });
  btnEl.classList.add('active');
  renderizarComissoes();
}

function ativarChipPeriodoPorTexto(texto) {
  document.querySelectorAll('.chip-periodo').forEach(function (b) {
    b.classList.toggle('active', b.textContent.trim() === texto);
  });
}

function alternarVisaoComissao(modo, btnEl) {
  visaoComissao = modo;
  document.querySelectorAll('.toggle-visao button').forEach(function (b) { b.classList.remove('active'); });
  btnEl.classList.add('active');
  renderizarComissoes();
}

// ============================================================
// FILTROS
// ============================================================
function getIntervaloPeriodoComissao() {
  var hoje = new Date();
  var inicio = null, fim = null;

  if (filtroPeriodoComissao === 'MES') {
    inicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    fim = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0, 23, 59, 59);
  } else if (filtroPeriodoComissao === 'MES_PASSADO') {
    inicio = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
    fim = new Date(hoje.getFullYear(), hoje.getMonth(), 0, 23, 59, 59);
  } else if (filtroPeriodoComissao === '3MESES') {
    inicio = new Date(hoje.getFullYear(), hoje.getMonth() - 2, 1);
    fim = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0, 23, 59, 59);
  } else if (filtroPeriodoComissao === 'ANO') {
    inicio = new Date(hoje.getFullYear(), 0, 1);
    fim = new Date(hoje.getFullYear(), 11, 31, 23, 59, 59);
  }

  return { inicio: inicio, fim: fim };
}

function getComissoesFiltradas() {
  var intervalo = getIntervaloPeriodoComissao();
  return Store.comissoes.filter(function (c) {
    if (filtroRepComissao !== "TODOS" && String(c.cod_rep) !== String(filtroRepComissao)) return false;
    if (filtroClienteComissao && String(c.cod_cliente) !== String(filtroClienteComissao)) return false;
    if (filtroStatusComissao !== "TODOS" && c.status_pedido !== filtroStatusComissao) return false;
    if (intervalo.inicio && (c.data < intervalo.inicio || c.data > intervalo.fim)) return false;
    return true;
  });
}

// ============================================================
// RENDERIZAÇÃO PRINCIPAL
// ============================================================
function renderizarComissoes() {
  if (!Store.carregado) return;
  var lista = getComissoesFiltradas();
  renderizarCardsComissao(lista);

  if (visaoComissao === 'REP') {
    renderizarTabelaPorRepresentante(lista);
  } else {
    renderizarTabelaTodosPedidos(lista);
  }
}

function renderizarCardsComissao(lista) {
  var totalVendido = lista.reduce(function (s, c) { return s + c.valor_total; }, 0);
  var totalComissao = lista.reduce(function (s, c) { return s + c.valor_comissao; }, 0);
  var qtdPedidos = lista.length;
  var percentualMedio = qtdPedidos > 0
    ? lista.reduce(function (s, c) { return s + c.percentual_comissao; }, 0) / qtdPedidos
    : 0;

  var html =
    '<div class="stat-box"><span>Total Vendido</span><b>' + fmtMoeda(totalVendido) + '</b></div>' +
    '<div class="stat-box"><span>Total em Comissão</span><b>' + fmtMoeda(totalComissao) + '</b></div>' +
    '<div class="stat-box"><span>Qtd. Pedidos</span><b>' + qtdPedidos + '</b></div>' +
    '<div class="stat-box"><span>% Comissão Média</span><b>' + percentualMedio.toFixed(2) + '%</b></div>';

  document.getElementById('cards-comissao').innerHTML = html;
}

// ---- Visão "Por Representante" (coletivo) ----
function renderizarTabelaPorRepresentante(lista) {
  var porRep = {};
  lista.forEach(function (c) {
    var cod = c.cod_rep || '—';
    if (!porRep[cod]) {
      porRep[cod] = { cod: cod, nome: c.nome_rep || ('Rep ' + cod), qtd: 0, totalVendido: 0, totalComissao: 0 };
    }
    porRep[cod].qtd++;
    porRep[cod].totalVendido += c.valor_total;
    porRep[cod].totalComissao += c.valor_comissao;
  });

  var reps = Object.keys(porRep).map(function (k) { return porRep[k]; })
    .sort(function (a, b) { return b.totalComissao - a.totalComissao; });

  var html = '<table><thead><tr>' +
    '<th>Representante</th><th>Qtd. Pedidos</th><th>Total Vendido</th><th>Total Comissão</th>' +
    '</tr></thead><tbody>';

  if (reps.length === 0) {
    html += '<tr><td colspan="4" style="text-align:center; color:#999;">Nenhum resultado para esses filtros.</td></tr>';
  }

  reps.forEach(function (r) {
    html += '<tr class="row-click" onclick="abrirModalRepresentante(\'' + r.cod + '\')">' +
      '<td>' + r.cod + ' - ' + r.nome + '</td>' +
      '<td>' + r.qtd + '</td>' +
      '<td>' + fmtMoeda(r.totalVendido) + '</td>' +
      '<td><b>' + fmtMoeda(r.totalComissao) + '</b></td>' +
      '</tr>';
  });

  html += '</tbody></table>';
  document.getElementById('tabela-comissoes').innerHTML = html;
}

// ---- Visão "Todos os Pedidos" (individual, tudo clicável) ----
function renderizarTabelaTodosPedidos(lista) {
  var ordenado = lista.slice().sort(function (a, b) { return b.data - a.data; });

  var html = '<table><thead><tr>' +
    '<th>Pedido</th><th>Data</th><th>Rep</th><th>Cliente</th><th>Valor</th><th>%</th><th>Comissão</th><th>Status</th>' +
    '</tr></thead><tbody>';

  if (ordenado.length === 0) {
    html += '<tr><td colspan="8" style="text-align:center; color:#999;">Nenhum resultado para esses filtros.</td></tr>';
  }

  ordenado.forEach(function (c) {
    html += '<tr class="row-click" onclick="abrirModalRepresentante(\'' + c.cod_rep + '\')">' +
      '<td>' + c.num_pedido + '</td>' +
      '<td>' + formatarData(c.data) + '</td>' +
      '<td>' + c.cod_rep + '</td>' +
      '<td>' + c.nome_cliente + '</td>' +
      '<td>' + fmtMoeda(c.valor_total) + '</td>' +
      '<td>' + c.percentual_comissao.toFixed(2) + '%</td>' +
      '<td><b>' + fmtMoeda(c.valor_comissao) + '</b></td>' +
      '<td>' + c.status_pedido + '</td>' +
      '</tr>';
  });

  html += '</tbody></table>';
  document.getElementById('tabela-comissoes').innerHTML = html;
}

// ============================================================
// METAS — leitura de dados salvos
// ============================================================
function getMetaRep(codRep, ano, mes) {
  var achou = Store.metas.find(function (m) {
    return String(m.cod_rep) === String(codRep) && Number(m.ano) === Number(ano) && Number(m.mes) === Number(mes);
  });
  return achou ? achou.valor_meta : null;
}

function getVendidoMesRep(codRep, ano, mes) {
  return Store.comissoes.filter(function (c) {
    return String(c.cod_rep) === String(codRep) &&
      c.data.getFullYear() === ano &&
      (c.data.getMonth() + 1) === mes;
  }).reduce(function (s, c) { return s + c.valor_total; }, 0);
}

function getComissaoFixaInfo(codRep) {
  return Store.comissoesFixas.find(function (f) { return String(f.cod_rep) === String(codRep); }) || null;
}

// Verifica se a comissão fixa vale pra um ano/mês específico (não só "agora"),
// pra poder aplicar corretamente linha a linha no histórico de pedidos também.
function isComissaoFixaAtivaNoMes(fixaInfo, ano, mes) {
  if (!fixaInfo || !fixaInfo.ativo) return false;
  var inicio = new Date(fixaInfo.ano_inicio, fixaInfo.mes_inicio - 1, 1);
  var fim = new Date(fixaInfo.ano_inicio, fixaInfo.mes_inicio - 1 + fixaInfo.duracao_meses, 0, 23, 59, 59);
  var alvo = new Date(ano, mes - 1, 15);
  return alvo >= inicio && alvo <= fim;
}

function isComissaoFixaAtivaAgora(fixaInfo) {
  var hoje = new Date();
  return isComissaoFixaAtivaNoMes(fixaInfo, hoje.getFullYear(), hoje.getMonth() + 1);
}

function calcularPercentualEsperado(codRep, ano, mes) {
  var fixaInfo = getComissaoFixaInfo(codRep);
  if (isComissaoFixaAtivaNoMes(fixaInfo, ano, mes)) {
    return fixaInfo.percentual_fixo || 10;
  }
  var meta = getMetaRep(codRep, ano, mes);
  var vendido = getVendidoMesRep(codRep, ano, mes);
  return calcularComissaoEsperada(vendido, meta);
}

// ============================================================
// COMUNICAÇÃO COM O APPS SCRIPT (salvar meta / comissão fixa)
// ============================================================
// Content-Type "text/plain" evita o preflight OPTIONS que o Apps Script
// não trata em doPost — se usar "application/json" aqui, a chamada
// falha por CORS silenciosamente.
function postParaAppsScript(payload) {
  return fetch(WEB_APP_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(payload)
  }).then(function (r) { return r.json(); });
}

// ============================================================
// MODAL DE DETALHE DO REPRESENTANTE (individual, com busca)
// ============================================================
function abrirModalRepresentante(codRep) {
  if (!codRep) return;
  modalRepCodAtual = codRep;

  // Ao abrir um representante, o período passa a ser sempre "Este mês"
  filtroPeriodoComissao = 'MES';
  ativarChipPeriodoPorTexto('Este mês');

  document.getElementById('modal-representante').style.display = 'flex';
  document.getElementById('busca-pedido-rep-modal').value = '';

  var achou = Store.comissoes.find(function (c) { return String(c.cod_rep) === String(codRep); });
  var nome = codRep + ' - ' + (achou ? (achou.nome_rep || 'Representante') : 'Representante');
  document.getElementById('modal-nome-rep').textContent = nome;

  renderizarStatsMetaRep(codRep);
  renderizarModalRepresentante();
  renderizarComissoes(); // a tabela de fundo também reflete o período "Este mês"
}

function fecharModalRepresentante() {
  document.getElementById('modal-representante').style.display = 'none';
  modalRepCodAtual = null;
}

function renderizarStatsMetaRep(codRep) {
  var agora = new Date();
  var ano = agora.getFullYear();
  var mes = agora.getMonth() + 1;

  var meta = getMetaRep(codRep, ano, mes);
  var vendido = getVendidoMesRep(codRep, ano, mes);
  var fixaInfo = getComissaoFixaInfo(codRep);
  var fixaAtiva = isComissaoFixaAtivaAgora(fixaInfo);

  var atingimento = meta ? (vendido / meta * 100) : null;
  var percentualEsperado = fixaAtiva ? (fixaInfo.percentual_fixo || 10) : calcularComissaoEsperada(vendido, meta);

  var html =
    '<div class="stat-box"><span>Meta do Mês</span><b>' + (meta ? fmtMoeda(meta) : '—') + '</b></div>' +
    '<div class="stat-box"><span>Vendido no Mês</span><b>' + fmtMoeda(vendido) + '</b></div>' +
    '<div class="stat-box"><span>% Atingido</span><b>' + (atingimento !== null ? atingimento.toFixed(1) + '%' : '—') + '</b></div>' +
    '<div class="stat-box"><span>Comissão Esperada' + (fixaAtiva ? ' (fixa)' : '') + '</span>' +
    '<b class="comissao-esperada-verde">' + (percentualEsperado !== null ? percentualEsperado.toFixed(2) + '%' : '—') + '</b></div>';

  document.getElementById('modal-rep-meta-stats').innerHTML = html;
  document.getElementById('toggle-comissao-fixa').checked = fixaAtiva;
}

function renderizarModalRepresentante() {
  if (!modalRepCodAtual) return;

  var termo = normalizarNome(document.getElementById('busca-pedido-rep-modal').value);
  var intervalo = getIntervaloPeriodoComissao();

  var pedidosRep = Store.comissoes.filter(function (c) {
    if (String(c.cod_rep) !== String(modalRepCodAtual)) return false;
    if (filtroStatusComissao !== "TODOS" && c.status_pedido !== filtroStatusComissao) return false;
    if (intervalo.inicio && (c.data < intervalo.inicio || c.data > intervalo.fim)) return false;
    if (termo) {
      var alvo = normalizarNome(c.nome_cliente + ' ' + c.num_pedido);
      if (alvo.indexOf(termo) === -1) return false;
    }
    return true;
  }).sort(function (a, b) { return b.data - a.data; });

  var totalVendido = pedidosRep.reduce(function (s, c) { return s + c.valor_total; }, 0);
  var totalComissao = pedidosRep.reduce(function (s, c) { return s + c.valor_comissao; }, 0);

  var html = '<div class="stats-grid cols-3">' +
    '<div class="stat-box"><span>Qtd. Pedidos</span><b>' + pedidosRep.length + '</b></div>' +
    '<div class="stat-box"><span>Total Vendido</span><b>' + fmtMoeda(totalVendido) + '</b></div>' +
    '<div class="stat-box"><span>Total Comissão</span><b>' + fmtMoeda(totalComissao) + '</b></div>' +
    '</div>';

  html += '<table><thead><tr>' +
    '<th>Pedido</th><th>Data</th><th>Cliente</th><th>Valor</th><th>%</th><th>Comissão</th><th>Status</th><th>% Esperado (Meta)</th>' +
    '</tr></thead><tbody>';

  if (pedidosRep.length === 0) {
    html += '<tr><td colspan="8" style="text-align:center; color:#999;">Nenhum pedido encontrado.</td></tr>';
  }

  pedidosRep.forEach(function (c) {
    var ano = c.data.getFullYear();
    var mes = c.data.getMonth() + 1;
    var percentualEsperado = calcularPercentualEsperado(modalRepCodAtual, ano, mes);

    html += '<tr>' +
      '<td>' + c.num_pedido + '</td>' +
      '<td>' + formatarData(c.data) + '</td>' +
      '<td>' + c.nome_cliente + '</td>' +
      '<td>' + fmtMoeda(c.valor_total) + '</td>' +
      '<td>' + c.percentual_comissao.toFixed(2) + '%</td>' +
      '<td><b>' + fmtMoeda(c.valor_comissao) + '</b></td>' +
      '<td>' + c.status_pedido + '</td>' +
      '<td class="comissao-esperada-verde">' + (percentualEsperado !== null ? percentualEsperado.toFixed(2) + '%' : '—') + '</td>' +
      '</tr>';
  });

  html += '</tbody></table>';
  document.getElementById('modal-rep-conteudo').innerHTML = html;
}

// ============================================================
// POPUP: DEFINIR META
// ============================================================
function abrirModalMeta() {
  if (!modalRepCodAtual) return;

  var select = document.getElementById('meta-mes-select');
  select.innerHTML = '';

  var agora = new Date();
  for (var i = 0; i < 6; i++) {
    var d = new Date(agora.getFullYear(), agora.getMonth() + i, 1);
    var opt = document.createElement('option');
    opt.value = d.getFullYear() + '-' + (d.getMonth() + 1);
    opt.textContent = MESES[d.getMonth()] + '/' + d.getFullYear();
    select.appendChild(opt);
  }

  select.onchange = preencherValorMetaSelecionado;
  preencherValorMetaSelecionado();

  document.getElementById('modal-meta-titulo').textContent = 'Definir Meta — ' + modalRepCodAtual;
  document.getElementById('modal-meta').style.display = 'flex';
}

function preencherValorMetaSelecionado() {
  var select = document.getElementById('meta-mes-select');
  var partes = select.value.split('-');
  var ano = Number(partes[0]), mes = Number(partes[1]);
  var metaAtual = getMetaRep(modalRepCodAtual, ano, mes);
  document.getElementById('meta-valor-input').value = metaAtual || '';
}

function fecharModalMeta() {
  document.getElementById('modal-meta').style.display = 'none';
}

function salvarMetaAtual() {
  var select = document.getElementById('meta-mes-select');
  var partes = select.value.split('-');
  var ano = Number(partes[0]), mes = Number(partes[1]);
  var valor = Number(document.getElementById('meta-valor-input').value || 0);

  if (valor <= 0) {
    alert('Informe um valor de meta válido.');
    return;
  }

  postParaAppsScript({ acao: 'salvar_meta', cod_rep: modalRepCodAtual, ano: ano, mes: mes, valor_meta: valor })
    .then(function (resp) {
      if (resp && resp.erro) { alert('Erro ao salvar meta: ' + resp.erro); return; }

      var idx = Store.metas.findIndex(function (m) {
        return String(m.cod_rep) === String(modalRepCodAtual) && Number(m.ano) === ano && Number(m.mes) === mes;
      });
      var registro = { cod_rep: modalRepCodAtual, ano: ano, mes: mes, valor_meta: valor };
      if (idx >= 0) Store.metas[idx] = registro; else Store.metas.push(registro);

      fecharModalMeta();
      renderizarStatsMetaRep(modalRepCodAtual);
      renderizarModalRepresentante();
    })
    .catch(function (erro) { alert('Erro ao salvar meta: ' + erro.message); });
}

// ============================================================
// POPUP: COMISSÃO FIXA
// ============================================================
function onToggleComissaoFixa(checkboxEl) {
  if (checkboxEl.checked) {
    checkboxEl.checked = false; // só confirma de verdade depois do popup
    abrirModalComissaoFixa();
  } else {
    desativarComissaoFixa();
  }
}

function abrirModalComissaoFixa() {
  document.getElementById('fixa-duracao-select').value = '3';
  document.getElementById('fixa-percentual-input').value = '10';
  document.getElementById('modal-comissao-fixa').style.display = 'flex';
}

function cancelarComissaoFixa() {
  document.getElementById('modal-comissao-fixa').style.display = 'none';
  document.getElementById('toggle-comissao-fixa').checked = false;
}

function confirmarComissaoFixa() {
  var duracao = Number(document.getElementById('fixa-duracao-select').value);
  var percentual = Number(document.getElementById('fixa-percentual-input').value || 10);
  var agora = new Date();

  postParaAppsScript({
    acao: 'salvar_comissao_fixa',
    cod_rep: modalRepCodAtual,
    ativo: true,
    ano_inicio: agora.getFullYear(),
    mes_inicio: agora.getMonth() + 1,
    duracao_meses: duracao,
    percentual_fixo: percentual
  }).then(function (resp) {
    if (resp && resp.erro) { alert('Erro ao ativar comissão fixa: ' + resp.erro); return; }

    var registro = {
      cod_rep: modalRepCodAtual, ativo: true,
      ano_inicio: agora.getFullYear(), mes_inicio: agora.getMonth() + 1,
      duracao_meses: duracao, percentual_fixo: percentual
    };
    var idx = Store.comissoesFixas.findIndex(function (f) { return String(f.cod_rep) === String(modalRepCodAtual); });
    if (idx >= 0) Store.comissoesFixas[idx] = registro; else Store.comissoesFixas.push(registro);

    document.getElementById('modal-comissao-fixa').style.display = 'none';
    document.getElementById('toggle-comissao-fixa').checked = true;
    renderizarStatsMetaRep(modalRepCodAtual);
    renderizarModalRepresentante();
  }).catch(function (erro) { alert('Erro ao ativar comissão fixa: ' + erro.message); });
}

function desativarComissaoFixa() {
  if (!modalRepCodAtual) return;

  postParaAppsScript({
    acao: 'salvar_comissao_fixa', cod_rep: modalRepCodAtual, ativo: false,
    ano_inicio: 0, mes_inicio: 0, duracao_meses: 0, percentual_fixo: 10
  }).then(function (resp) {
    if (resp && resp.erro) { alert('Erro ao desativar comissão fixa: ' + resp.erro); return; }

    var idx = Store.comissoesFixas.findIndex(function (f) { return String(f.cod_rep) === String(modalRepCodAtual); });
    if (idx >= 0) Store.comissoesFixas[idx].ativo = false;

    renderizarStatsMetaRep(modalRepCodAtual);
    renderizarModalRepresentante();
  }).catch(function (erro) { alert('Erro ao desativar comissão fixa: ' + erro.message); });
}
