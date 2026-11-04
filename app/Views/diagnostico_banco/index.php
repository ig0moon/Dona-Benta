<?= $this->extend('layouts/main') ?>

<?= $this->section('styles') ?>
  <style>
    .diagnostico {
      max-width: 760px;
      margin: 0 auto;
    }

    .diagnostico-cartao {
      padding: clamp(24px, 5vw, 40px);
      border: 1px solid var(--creme-escuro);
      border-radius: var(--raio-md);
      background: var(--branco);
      box-shadow: var(--sombra-suave);
    }

    .diagnostico-resultado {
      margin: 24px 0;
      padding: 18px;
      border-radius: var(--raio-sm);
      background: var(--creme);
    }

    .diagnostico-resultado[data-status="success"] {
      border-left: 5px solid var(--sucesso);
    }

    .diagnostico-resultado[data-status="failure"],
    .diagnostico-resultado[data-status="missing"],
    .diagnostico-resultado[data-status="schema_missing"],
    .diagnostico-resultado[data-status="migration_missing"] {
      border-left: 5px solid var(--erro);
    }

    .diagnostico-lista {
      margin: 12px 0 0 20px;
      overflow-wrap: anywhere;
    }

    .diagnostico-aviso {
      margin-top: 20px;
      color: var(--marrom-claro);
      font-size: 0.95rem;
    }
  </style>
<?= $this->endSection() ?>

<?= $this->section('content') ?>
  <section class="pagina-header">
    <div class="container">
      <span class="eyebrow">Diagnóstico</span>
      <h1>Teste de conexão com o TiDB</h1>
      <p>Verifica as configurações do servidor e executa uma consulta simples, sem alterar dados.</p>
    </div>
  </section>

  <main class="secao">
    <div class="container diagnostico">
      <div class="diagnostico-cartao">
        <h2>Conexão do banco</h2>
        <p>O teste executa somente <code>SELECT 1</code>. Nenhum dado ou tabela é alterado.</p>

        <?php if (!empty($diagnostic['status'])): ?>
          <div class="diagnostico-resultado" data-status="<?= esc($diagnostic['status']) ?>" role="status" aria-live="polite">
            <strong>
              <?php if ($diagnostic['status'] === 'success'): ?>
                Conexão funcionando
              <?php elseif (in_array($diagnostic['status'], ['missing', 'schema_missing', 'migration_missing'], true)): ?>
                Configuração incompleta
              <?php else: ?>
                Falha na conexão
              <?php endif ?>
            </strong>
            <p><?= esc($diagnostic['message']) ?></p>

            <?php if (!empty($diagnostic['missing'])): ?>
              <p>
                <?php if (in_array($diagnostic['status'], ['schema_missing', 'migration_missing'], true)): ?>
                  Execute no TiDB:
                <?php else: ?>
                  Configure no Render:
                <?php endif ?>
              </p>
              <ul class="diagnostico-lista">
                <?php foreach ($diagnostic['missing'] as $variable): ?>
                  <li><code><?= esc($variable) ?></code></li>
                <?php endforeach ?>
              </ul>
            <?php endif ?>
          </div>
        <?php endif ?>

        <form method="post" action="<?= base_url('teste-banco') ?>">
          <button type="submit" class="btn btn-primario">Testar conexão agora</button>
        </form>

        <p class="diagnostico-aviso">
          O catálogo, os pedidos, as contas e os arquivos do site usam somente o TiDB.
          Este teste verifica a mesma conexão configurada para esses dados.
        </p>
      </div>
    </div>
  </main>
<?= $this->endSection() ?>
