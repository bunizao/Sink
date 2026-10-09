"""Browser regression checks for the fork UI; requires Python Playwright."""
import sys
from playwright.sync_api import sync_playwright, expect

def check_animation():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.route('https://api.github.com/repos/**', lambda route: route.fulfill(json={'stargazers_count': 7198, 'forks_count': 5322}))
        page.add_init_script('''
          window.__hidden = false;
          Object.defineProperty(document, 'hidden', {get: () => window.__hidden});
          Object.defineProperty(document, 'visibilityState', {get: () => window.__hidden ? 'hidden' : 'visible'});
          window.__changes = 0;
        ''')
        page.goto(sys.argv[1])
        page.wait_for_load_state('networkidle')
        expect(page.locator('.cat-art')).to_be_visible()
        page.evaluate("new MutationObserver(() => window.__changes++).observe(document.querySelector('.cat-art'),{subtree:true,childList:true,characterData:true})")
        page.wait_for_timeout(1100)
        assert page.evaluate('window.__changes') > 0, 'Visible animation did not run'
        page.evaluate("window.__hidden=true;document.dispatchEvent(new Event('visibilitychange'))")
        page.wait_for_timeout(100)
        page.evaluate('window.__changes=0')
        page.wait_for_timeout(1100)
        hidden = page.evaluate('window.__changes')
        assert hidden == 0, f'Hidden page performed {hidden} animation updates'
        page.evaluate("window.__hidden=false;document.dispatchEvent(new Event('visibilitychange'))")
        page.wait_for_timeout(1100)
        assert page.evaluate('window.__changes') > 0, 'Animation did not resume'
        page.emulate_media(reduced_motion='reduce')
        page.wait_for_timeout(100)
        page.evaluate('window.__changes=0')
        page.wait_for_timeout(1100)
        assert page.evaluate('window.__changes') == 0, 'Reduced-motion setting did not stop animation'
        browser.close()
    print('Visible, hidden, resumed, and reduced-motion animation checks passed')

def check_stats_cache():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(reduced_motion='reduce')
        calls = []
        page.route('https://api.github.com/repos/**', lambda route: (calls.append(route.request.url), route.fulfill(json={'stargazers_count': 1234, 'forks_count': 4321})))
        page.goto(sys.argv[1])
        page.wait_for_load_state('networkidle')
        expect(page.get_by_text('★ 1234 stars · ⑂ 4321 forks', exact=True)).to_be_visible()
        assert len(calls) == 1
        page.reload()
        page.wait_for_load_state('networkidle')
        expect(page.get_by_text('★ 1234 stars · ⑂ 4321 forks', exact=True)).to_be_visible()
        assert len(calls) == 1, 'Reload fetched the same statistics again'
        page.evaluate("const data=JSON.parse(sessionStorage.getItem('tuu-github-stats'));data.expiresAt=Date.now()-1;sessionStorage.setItem('tuu-github-stats',JSON.stringify(data))")
        page.reload()
        page.wait_for_load_state('networkidle')
        assert len(calls) == 2, 'Expired cache did not refresh'
        page.evaluate("const data=JSON.parse(sessionStorage.getItem('tuu-github-stats'));data.repo='https://github.com/example/other';sessionStorage.setItem('tuu-github-stats',JSON.stringify(data))")
        page.reload()
        page.wait_for_load_state('networkidle')
        assert len(calls) == 3, 'Different repository reused the old cache'
        page.evaluate("sessionStorage.setItem('tuu-github-stats', 'invalid-json')")
        page.reload()
        page.wait_for_load_state('networkidle')
        assert len(calls) == 4, 'Invalid cache prevented fresh statistics'
        browser.close()
    print('Reload cache, expiry, repository change, and invalid storage checks passed')

def check_error_cleanup():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.route('https://api.github.com/repos/**', lambda r: r.fulfill(json={'stargazers_count': 7198, 'forks_count': 5322}))
        page.add_init_script('''
          Math.random = () => 0;
          window.__shortTimers = 0;
          const timeout = window.setTimeout;
          window.setTimeout = (callback, delay, ...args) => timeout(() => {
            if (delay === 50 || delay === 60) window.__shortTimers++;
            callback(...args);
          }, delay);
        ''')
        page.goto(sys.argv[1] + '/perf-nonexistent')
        page.wait_for_load_state('networkidle')
        expect(page.locator('.neon-text')).to_be_visible()
        page.wait_for_timeout(300)
        assert page.evaluate('window.__shortTimers') > 0
        # Leave during the recovery timeout, when the old code lost its timer handle.
        page.wait_for_function("document.querySelector('.neon-container').className.includes('flicker')")
        page.get_by_role('link', name='$ cd /home').click()
        expect(page.locator('.cat-art')).to_be_visible()
        page.wait_for_timeout(200)
        page.evaluate('window.__shortTimers=0')
        page.wait_for_timeout(400)
        remaining = page.evaluate('window.__shortTimers')
        print('Error animation callbacks after leaving:', remaining)
        assert remaining == 0, 'Error animation continued after unmount'
        browser.close()

def check_optional_network():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(reduced_motion='reduce')
        errors = []
        fonts = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.on('request', lambda request: fonts.append(request.url) if 'fonts.googleapis.com' in request.url or 'fonts.gstatic.com' in request.url else None)
        page.route('https://api.github.com/repos/**', lambda route: route.abort())
        page.add_init_script("Object.defineProperty(window, 'sessionStorage', {get: () => { throw new Error('Storage blocked') }})")
        page.goto(sys.argv[1])
        page.wait_for_load_state('networkidle')
        expect(page.locator('.cat-art')).to_be_visible()
        expect(page.get_by_text('★ 6000 stars · ⑂ 4000 forks', exact=True)).to_be_visible()
        page.locator('.terminal-input').fill('cat')
        page.locator('.terminal-input').press('Enter')
        expect(page.get_by_text('meow~', exact=True)).to_be_visible()
        assert not fonts, 'Terminal still requests an external font'
        assert not errors, errors
        browser.close()
    print('Offline statistics, blocked storage, local font, and terminal interaction checks passed')

if __name__ == "__main__":
    check_animation()
    check_stats_cache()
    check_error_cleanup()
    check_optional_network()
