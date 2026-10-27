<?= $this->extend('layouts/main') ?>

<?= $this->section('content') ?>
  <section class="pagina-header">
    <div class="container">
      <span class="eyebrow">Nosso catálogo</span>
      <h1>Tudo que sai do nosso forno</h1>
      <p>Escolha entre bolos, pães, doces e salgados preparados artesanalmente com receitas de família.</p>
    </div>
  </section>

  <main class="secao">
    <div class="container">
      <div class="busca-linha">
        <span class="material-symbols-outlined">search</span>
        <input type="text" id="campoBusca" placeholder="Buscar bolos, pães, doces..." aria-label="Buscar produtos">
      </div>

      <div class="filtros" id="filtros">
        <button type="button" class="filtro-btn <?= ($categoria === 'todos' || empty($categoria)) ? 'ativo' : '' ?>" data-categoria="todos">
          <span class="material-symbols-outlined">apps</span> Todos
        </button>
        <?php foreach ($categorias as $chave => $info): ?>
          <button type="button" class="filtro-btn <?= ($categoria === $chave) ? 'ativo' : '' ?>" data-categoria="<?= esc($chave) ?>">
            <span class="material-symbols-outlined"><?= esc($info['icone']) ?></span> <?= esc($info['nome']) ?>
          </button>
        <?php endforeach; ?>
      </div>

      <div id="areaCatalogo">
        <div class="spinner"></div>
      </div>
    </div>
  </main>
<?= $this->endSection() ?>

<?= $this->section('scripts') ?>
  <script src="<?= base_url('js/catalogo.js?v=3.0') ?>"></script>
<?= $this->endSection() ?>
