"""Exercise Valdória through its production build with isolated storage."""
import os
from pathlib import Path
import socket
import subprocess
import time
import urllib.request
from contextlib import contextmanager
from uuid import uuid4

from playwright.sync_api import expect, sync_playwright

ROOT = Path(__file__).resolve().parents[1]
MONGO = os.getenv("VALDORIA_TEST_MONGO")


@contextmanager
def server(uri="disabled"):
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        port = sock.getsockname()[1]
    database = "reino_valdoria_test_" + uuid4().hex[:10]
    env = {**os.environ, "PORT": str(port), "HOST": "127.0.0.1",
           "MONGODB_URI": uri, "MONGODB_DATABASE": database}
    address = f"http://127.0.0.1:{port}"
    process = subprocess.Popen(["node", "server/index.js"], cwd=ROOT, env=env)
    try:
        for _ in range(70):
            try:
                with urllib.request.urlopen(address + "/api/health", timeout=1) as response:
                    if response.status == 200:
                        break
            except OSError:
                if process.poll() is not None:
                    raise RuntimeError("Execute npm run build antes dos testes de navegador.")
                time.sleep(0.15)
        else:
            raise RuntimeError("Servidor de teste indisponível.")
        yield address
    finally:
        process.terminate()
        process.wait(timeout=12)
        if uri != "disabled":
            subprocess.run(["node", "--input-type=module", "-e", """
                import { MongoClient } from 'mongodb';
                const client = new MongoClient(process.env.MONGODB_URI);
                try { await client.db(process.env.MONGODB_DATABASE).dropDatabase(); }
                finally { await client.close(); }
            """], cwd=ROOT, env=env, check=True)


def open_page(browser, address, width=1060, height=720, mobile=False):
    context = browser.new_context(viewport={"width": width, "height": height},
                                  reduced_motion="reduce", is_mobile=mobile,
                                  has_touch=mobile, ignore_https_errors=False)
    page = context.new_page()
    page.set_default_timeout(18000)
    issues = []

    def collect_console(message):
        # The offline atlas reports an expected 503, and SwiftShader may emit
        # internal driver messages while Chromium captures a thumbnail.
        if message.type == "error" and "status of 503" not in message.text:
            issues.append(message.text)

    page.on("console", collect_console)
    page.on("pageerror", lambda error: issues.append(str(error)))
    page.on("response", lambda response: issues.append(f"{response.status} {response.url}")
            if response.status in (401, 404, 500) else None)
    page.goto(address, wait_until="networkidle", timeout=45000)
    page.locator("#app[data-ready=true]").wait_for(timeout=45000)
    expect(page.locator(".world-canvas")).to_have_count(1)
    return context, page, issues


def action(page, name, scope=""):
    return page.locator(f"{scope} [data-action='{name}']").first


def assert_catalogue_centered(page):
    catalogue = page.get_by_role("dialog", name="Construir")
    expect(catalogue).to_be_visible()
    box = catalogue.bounding_box()
    assert abs(box["x"] + box["width"] / 2 - page.viewport_size["width"] / 2) <= 1
    assert abs(box["y"] + box["height"] / 2 - page.viewport_size["height"] / 2) <= 1


def stored(page, slot):
    return page.evaluate("""
        slot => new Promise((resolve, reject) => {
          const open = indexedDB.open('reino-valdoria-saves', 1);
          open.onerror = () => reject(open.error);
          open.onsuccess = () => {
            const req = open.result.transaction('kingdoms').objectStore('kingdoms').get(slot);
            req.onsuccess = () => { open.result.close(); resolve(req.result?.state ?? null); };
            req.onerror = () => reject(req.error);
          };
        })
    """, slot)


def assert_no_errors(issues):
    assert not issues, "\n".join(issues)


def offline(browser, address):
    context, page, issues = open_page(browser, address)
    expect(page.locator("#gold")).to_have_text("5.000")
    saved = stored(page, "own")
    assert saved["starterPerimeter"]
    assert sum(obj["type"] == "cityGate" for obj in saved["objects"]) == 3
    expect(page.locator("#game > header")).to_have_count(0)
    expect(page.get_by_text("Vale de Valdória", exact=True)).not_to_be_visible()
    expect(page.get_by_text("Seu reino", exact=True)).not_to_be_visible()
    expect(page.locator("#catalogue")).not_to_be_visible()
    page.get_by_role("button", name="Enquadrar castelo").click()
    expect(page.locator("#selection h3")).to_have_text("Castelo Nível 1")
    expect(action(page, "gate", "#selection")).to_have_text("Fechar portão")
    action(page, "gate", "#selection").click()
    expect(action(page, "gate", "#selection")).to_have_text("Abrir portão")
    action(page, "undo", ".dock").click()
    expect(action(page, "gate", "#selection")).to_have_text("Fechar portão")
    action(page, "settings", ".game-tools").click()
    expect(page.get_by_label("Nome do reino")).to_have_value("Vale de Valdória")
    action(page, "saves", "#panel").click()
    page.locator('#panel [data-value="empty"]').click()
    expect(page.locator("#panel")).not_to_be_visible()
    expect(page.locator("#people")).to_have_text("0")

    catalogue_button = action(page, "catalogue", ".dock")
    catalogue_button.click()
    assert_catalogue_centered(page)
    page.keyboard.press("Escape")
    expect(catalogue_button).to_have_attribute("aria-expanded", "false")
    catalogue_button.click()
    page.locator('[data-item="hut"]').click()
    expect(page.locator("#catalogue")).not_to_be_visible()
    expect(page.locator("#placement")).to_be_visible()
    expect(action(page, "confirm", "#placement")).to_have_count(0)
    action(page, "rotate", "#placement").click()
    action(page, "repeat", "#placement").click()
    page.mouse.move(530, 360)
    page.mouse.down()
    page.mouse.move(580, 360, steps=3)
    page.mouse.move(530, 360, steps=3)
    page.mouse.up()
    expect(page.locator("#gold")).to_have_text("5.000")
    action(page, "overview", ".camera-tools").click()
    page.mouse.click(530, 360)
    expect(page.locator("#gold")).to_have_text("4.890")
    expect(page.locator("#people")).to_have_text("3")
    page.mouse.click(530, 360)
    expect(page.locator("#toast")).to_have_text("A área está ocupada.")
    expect(page.locator("#gold")).to_have_text("4.890")
    action(page, "cancel", "#placement").click()
    page.wait_for_function("""
      async () => {
        const db = await new Promise(resolve => {
          const r = indexedDB.open('reino-valdoria-saves',1);
          r.onsuccess = () => resolve(r.result);
        });
        return new Promise(resolve => {
          const r = db.transaction('kingdoms').objectStore('kingdoms').get('empty');
          r.onsuccess = () => { db.close(); resolve(r.result?.state?.objects.length===1); };
        });
      }
    """)
    assert stored(page, "empty")["objects"][0]["rotation"] == 1

    page.mouse.click(530, 360)
    expect(page.locator("#selection h3")).to_have_text("Casebre de palha")
    action(page, "move", "#selection").click()
    expect(page.locator("#placement")).to_be_visible()
    expect(action(page, "confirm", "#placement")).to_have_count(0)
    page.mouse.click(650, 360)
    expect(page.locator("#toast")).to_have_text("Construção movida.")
    expect(page.locator("#placement")).not_to_be_visible()
    expect(page.locator("#gold")).to_have_text("4.890")
    page.mouse.click(530, 360)
    expect(page.locator("#selection")).not_to_be_visible()
    page.mouse.click(650, 360)
    expect(page.locator("#selection h3")).to_have_text("Casebre de palha")
    action(page, "undo", ".dock").click()
    page.mouse.click(530, 360)
    expect(page.locator("#selection h3")).to_have_text("Casebre de palha")

    action(page, "undo", ".dock").click()
    expect(page.locator("#gold")).to_have_text("5.000")

    catalogue_button.click()
    page.locator('[data-category="walls"]').click()
    page.locator('[data-item="wall"]').click()
    action(page, "line", "#placement").click()
    page.mouse.click(530, 360)
    expect(page.locator("#gold")).to_have_text("5.000")
    page.locator(".world-canvas").focus()
    for _ in range(16):
        page.keyboard.press("ArrowRight")
    page.keyboard.press("Enter")
    expect(page.locator("#gold")).to_have_text("4.856")
    action(page, "undo", ".dock").click()
    expect(page.locator("#gold")).to_have_text("5.000")

    action(page, "territory", ".dock").click()
    expect(page.locator("#panel")).to_contain_text("faixa de terreno plano de 36 m")
    page.locator('#panel [data-value="north"]').click()
    expect(page.locator("#gold")).to_have_text("4.330")
    action(page, "settings", ".game-tools").click()
    action(page, "save", "#panel").click()
    expect(page.get_by_text("Salvamento atualizado.")).to_be_visible()
    page.reload(wait_until="networkidle")
    page.locator("#app[data-ready=true]").wait_for(timeout=45000)
    action(page, "settings", ".game-tools").click()
    action(page, "saves", "#panel").click()
    page.locator('#panel [data-value="empty"]').click()
    expect(page.locator("#gold")).to_have_text("4.330")
    assert stored(page, "empty")["territory"]["north"] == 1
    action(page, "walk", ".dock").click()
    expect(page.locator("#crosshair")).to_be_visible()
    action(page, "map", ".dock").click()
    expect(page.get_by_text("O servidor multiplayer está indisponível.", exact=False)).to_be_visible()
    assert_no_errors(issues)
    context.close()
    print("OK navegador sem MongoDB: construção, movimentação, linha, rotação, desfazer, expansão, IndexedDB e câmera.")


def enter_and_publish(page, alias, realm):
    action(page, "settings", ".game-tools").click()
    page.get_by_label("Nome do reino").fill(realm)
    page.get_by_role("button", name="Aplicar").click()
    action(page, "map", ".dock").click()
    page.get_by_label("Nome do jogador").fill(alias)
    page.locator("#profile-form button").click()
    expect(page.get_by_text(alias, exact=True)).to_be_visible()
    action(page, "publish", "#atlas").click()
    expect(page.get_by_text("Seu reino está no mapa-múndi.")).to_be_visible(timeout=18000)
    expect(page.locator(".map-pin.mine")).to_have_count(1)


def multiplayer(browser, address):
    first, aria, errors_a = open_page(browser, address, 930, 660)
    enter_and_publish(aria, "Aria do Vale", "Castelo de Aria")
    second, ulric, errors_b = open_page(browser, address, 930, 660)
    enter_and_publish(ulric, "Ulric da Serra", "Castelo de Ulric")
    expect(ulric.locator(".map-pin")).to_have_count(2)
    ulric.locator("#atlas-search").fill("Aria")
    expect(ulric.locator(".map-pin")).to_have_count(1)
    ulric.get_by_role("button", name="Visitar Castelo de Aria").click()
    expect(ulric.locator("#visit strong")).to_have_text("Castelo de Aria")
    expect(action(ulric, "catalogue", ".dock")).to_be_disabled()
    aria.get_by_role("button", name="Visitar Castelo de Aria").click()
    expect(aria.locator("#visit strong")).to_have_text("Castelo de Aria")
    expect(aria.locator("#visit")).to_contain_text("1 visitante", timeout=30000)
    expect(ulric.locator("#visit")).to_contain_text("1 visitante", timeout=30000)
    action(ulric, "leave", "#visit").click()
    expect(ulric.locator("#visit")).not_to_be_visible()
    expect(action(ulric, "catalogue", ".dock")).to_be_enabled()
    assert_no_errors(errors_a)
    assert_no_errors(errors_b)
    first.close()
    second.close()
    print("OK multiplayer: dois perfis, dois castelos, busca, visitas e presença simultânea.")


def mobile_layout(browser, address):
    context, page, issues = open_page(browser, address, 390, 844, mobile=True)
    action(page, "settings", ".game-tools").tap()
    action(page, "saves", "#panel").tap()
    page.locator('#panel [data-value="empty"]').tap()
    expect(page.locator("#panel")).not_to_be_visible()
    expect(page.locator("#catalogue")).not_to_be_visible()
    action(page, "catalogue", ".dock").tap()
    assert_catalogue_centered(page)
    page.locator('[data-item="hut"]').tap()
    expect(page.locator("#placement")).to_be_visible()
    expect(page.locator("#catalogue")).not_to_be_visible()
    page.touchscreen.tap(195, 422)
    expect(page.locator("#gold")).to_have_text("4.890")
    expect(page.locator("#placement")).not_to_be_visible()
    page.touchscreen.tap(195, 422)
    action(page, "move", "#selection").tap()
    page.touchscreen.tap(275, 422)
    expect(page.locator("#toast")).to_have_text("Construção movida.")
    expect(page.locator("#placement")).not_to_be_visible()
    action(page, "walk", ".dock").tap()
    expect(page.locator("#touch-walk")).to_be_visible()
    assert page.evaluate("matchMedia('(prefers-reduced-motion: reduce)').matches")
    action(page, "map", ".dock").tap()
    expect(page.get_by_role("heading", name="Mapa-múndi")).to_be_visible()
    assert page.evaluate("document.documentElement.scrollWidth <= innerWidth")
    assert_no_errors(issues)
    context.close()
    print("OK celular: catálogo centralizado, construção e movimentação por toque, mapa e movimento reduzido.")


def main():
    with sync_playwright() as playwright:
        options = {"headless": True, "args": ["--use-gl=angle", "--use-angle=swiftshader",
                                              "--enable-unsafe-swiftshader"]}
        channel = os.getenv("VALDORIA_BROWSER_CHANNEL")
        if channel:
            options["channel"] = channel
        with playwright.chromium.launch(**options) as browser:
            with server() as address:
                offline(browser, address)
                mobile_layout(browser, address)
            if MONGO:
                with server(MONGO) as address:
                    multiplayer(browser, address)
            else:
                print("Multiplayer ignorado: defina VALDORIA_TEST_MONGO para rodar este cenário.")


if __name__ == "__main__":
    main()

