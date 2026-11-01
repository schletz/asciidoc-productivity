/**
 * Webview script of the AsciiDoc preview. Renders the full text of every `update` message
 * sent by PreviewService. Loaded with `defer` after asciidoctor.min.js (window.Asciidoctor),
 * asciidoctor-kroki.js, highlight.min.js and MathJax; `printRawHtml` is defined by an inline
 * script of the page. Errors replace the content with a red message.
 */
try {
    const asciidoctor = window.Asciidoctor();
    window.AsciidoctorKroki.register(asciidoctor.Extensions);
    const contentDiv = document.getElementById('content');
    contentDiv.innerHTML = "<i>Preview ready. (Please type to render text)</i>";
    /**
     * Converts AsciiDoc to HTML and applies syntax highlighting and math typesetting.
     * `safe` mode keeps asciidoctor.js from reading files; includes are resolved beforehand.
     * @param {string} text - Document source with includes and the Kroki URL already inserted.
     */
    function renderAsciiDoc(text) {
        const html = asciidoctor.convert(text, {
            safe: 'safe',
            attributes: {
                showtitle: true,
                icons: 'font',
                'kroki-default-format': 'svg',
                'source-highlighter': 'highlight.js',
                stem: 'latexmath'
            }
        });
        if (printRawHtml) {
            contentDiv.innerHTML = "";
            const preElement = document.createElement("pre");
            preElement.innerText = html;
            contentDiv.appendChild(preElement);
            return;
        }
        contentDiv.innerHTML = html;

        if (typeof hljs !== 'undefined') {
            hljs.highlightAll();
        }

        if (typeof MathJax !== 'undefined' && MathJax.typesetPromise) {
            // The content is replaced on every update, so MathJax must forget the old nodes.
            MathJax.typesetClear([contentDiv]);
            MathJax.typesetPromise([contentDiv]).catch(function (err) {
                console.error('MathJax rendering failed: ' + err.message);
            });
        }
    }

    window.addEventListener('message', event => {
        try {
            const message = event.data;
            if (message.command === 'update') {
                renderAsciiDoc(message.text);
            }
        }
        catch (e) {
            document.getElementById('content').innerHTML = '<div style="color:red;">' + e.message + '</div>';
        }
    });
}
catch (e) {
    document.getElementById('content').innerHTML = '<div style="color:red;">' + e.message + '</div>';
}
