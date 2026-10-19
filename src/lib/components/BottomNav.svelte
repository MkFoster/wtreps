<script lang="ts">
  import { page } from '$app/state';

  const links = [
    { href: '/', label: 'Home', symbol: '⌂' },
    { href: '/history', label: 'History', symbol: '◷' },
    { href: '/manage', label: 'Manage', symbol: '☷' },
    { href: '/settings', label: 'Settings', symbol: '⚙' },
  ];
</script>

<nav aria-label="Main navigation">
  {#each links as link}
    <a
      href={link.href}
      aria-current={page.url.pathname === link.href ||
      (link.href === '/manage' &&
        (page.url.pathname.startsWith('/exercises') || page.url.pathname.startsWith('/circuits')))
        ? 'page'
        : undefined}
    >
      <span aria-hidden="true">{link.symbol}</span>
      {link.label}
    </a>
  {/each}
</nav>

<style>
  nav {
    position: fixed;
    inset: auto 0 0;
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    padding: var(--space-sm) max(var(--space-sm), env(safe-area-inset-right))
      max(var(--space-sm), env(safe-area-inset-bottom))
      max(var(--space-sm), env(safe-area-inset-left));
    background: var(--color-surface);
    border-top: 1px solid var(--color-border);
    z-index: 1;
  }
  a {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.125rem;
    min-height: 60px;
    padding: var(--space-sm) 0;
    border-radius: var(--radius-md);
    color: var(--color-muted);
    font-size: 1rem;
    font-weight: 600;
    text-decoration: none;
  }
  span {
    font-size: 1.5rem;
    line-height: 1;
  }
  a[aria-current='page'] {
    background: var(--color-accent-soft);
    color: var(--color-accent);
  }
</style>
