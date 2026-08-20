// js/login.js
const abaEntrar = document.getElementById('abaEntrar');
const abaCadastrar = document.getElementById('abaCadastrar');
const formEntrar = document.getElementById('formEntrar');
const formCadastrar = document.getElementById('formCadastrar');

if(abaEntrar) {
    abaEntrar.addEventListener('click', () => {
        abaEntrar.classList.add('ativa'); abaCadastrar.classList.remove('ativa');
        formEntrar.classList.add('ativo'); formCadastrar.classList.remove('ativo');
    });

    abaCadastrar.addEventListener('click', () => {
        abaCadastrar.classList.add('ativa'); abaEntrar.classList.remove('ativa');
        formCadastrar.classList.add('ativo'); formEntrar.classList.remove('ativo');
    });
}

// Redireciona se já estiver logado
(async () => {
    const usuario = await usuarioAtual();
    if (usuario) {
        const perfil = await perfilAtual();
        if(perfil?.role === 'admin') window.location.href = 'index.html';
        else if(perfil?.role === 'funcionario') window.location.href = 'index.html';
        else window.location.href = 'conta.html';
    }
})();

formEntrar?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('btnEntrar'); btn.disabled = true;
    const email = document.getElementById('emailEntrar').value;
    const senha = document.getElementById('senhaEntrar').value;

    const { data, error } = await db.auth.signInWithPassword({ email, password: senha });
    btn.disabled = false;

    if (error) { mostrarToast('E-mail ou senha incorretos', 'erro'); return; }

    mostrarToast('Login realizado com sucesso!', 'sucesso');
    const perfil = await perfilAtual();
    setTimeout(() => {
        if(perfil?.role === 'admin') window.location.href = 'index.html';
        else if(perfil?.role === 'funcionario') window.location.href = 'index.html';
        else window.location.href = 'conta.html';
    }, 800);
});

formCadastrar?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('btnCadastrar'); btn.disabled = true;
    const nome = document.getElementById('nomeCadastro').value;
    const telefone = document.getElementById('telefoneCadastro').value;
    const email = document.getElementById('emailCadastro').value;
    const senha = document.getElementById('senhaCadastro').value;

    const { data, error } = await db.auth.signUp({ email, password: senha });
    if (error) { mostrarToast(error.message || 'Erro ao criar conta', 'erro'); btn.disabled = false; return; }

    if (data.user) {
        await db.from('perfis').insert({ id: data.user.id, nome, telefone, role: 'cliente' });
    }

    btn.disabled = false;
    mostrarToast('Conta criada com sucesso!', 'sucesso');
    setTimeout(() => window.location.href = 'conta.html', 1200);
});

document.getElementById('linkEsqueciSenha')?.addEventListener('click', async (e) => {
    e.preventDefault();
    const email = document.getElementById('emailEntrar').value;
    if (!email) { mostrarToast('Digite seu e-mail no campo acima primeiro', 'info'); return; }
    const { error } = await db.auth.resetPasswordForEmail(email);
    if (error) mostrarToast('Erro ao enviar e-mail de recuperação', 'erro');
    else mostrarToast('E-mail de recuperação enviado!', 'sucesso');
});