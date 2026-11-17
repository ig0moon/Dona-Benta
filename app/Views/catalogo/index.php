<?= $this->extend('layouts/main') ?>

<?= $this->section('content') ?>
  <section class="pagina-header">
    <div class="container">
      <span class="eyebrow">Cardápio</span>
      <h1>Tudo que sai do nosso forno.</h1>
      <p>Bolos, pães, doces, salgados e tortas preparados à mão, com receitas de família.</p>
    </div>
  </section>

  <main class="secao">
    <div class="container">
      <div class="busca-linha">
        <span class="material-symbols-outlined">search</span>
        <input type="text" id="campoBusca" placeholder="Buscar bolos, pães, doces..." aria-label="Buscar produtos">
      </div>

      <div class="filtros" id="filtros" role="tablist" aria-label="Categorias">
        <button type="button" class="filtro-btn <?= ($categoria === 'todos' || empty($categoria)) ? 'ativo' : '' ?>" data-categoria="todos">
          Todos
        </button>
        <?php foreach ($categorias as $chave => $info): ?>
          <button type="button" class="filtro-btn <?= ($categoria === $chave) ? 'ativo' : '' ?>" data-categoria="<?= esc($chave) ?>">
            <?= esc($info['nome']) ?>
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
  <script src="<?= base_url('js/catalogo.js?v=4.0') ?>"></script>
<?= $this->endSection() ?>
