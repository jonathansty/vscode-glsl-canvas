/* global window, document, console, GlslCanvas, CaptureService, GuiService, TrailsService, CameraService, Stats, dat */

(function () {
    'use strict';

    function onLoad() {
        var stats, statsdom;

        var content = document.querySelector('.content');
        var canvas = document.querySelector('.shader');
        var buttons = {
            pause: document.querySelector('.btn-pause'),
            record: document.querySelector('.btn-record'),
            stats: document.querySelector('.btn-stats'),
            create: document.querySelector('.btn-create'),
        };
        var flags = {
            toggle: false,
            record: false,
            stats: false,
        };

        resize(true);

        var glsl = new GlslCanvas(canvas, {
            premultipliedAlpha: false,
            preserveDrawingBuffer: true,
            backgroundColor: 'rgba(1,1,1,1)',
        });
        glsl.on('error', onGlslError);

        var capture = new CaptureService();
        capture.set(canvas);

        var camera = new CameraService();

        var trails = new TrailsService();

        glsl.on('render', function () {
            capture.snapshotRender();
            camera.render(glsl);
            trails.render(glsl);
            glsl.forceRender = true;
        });

        function onUpdateUniforms(params) {
            var uniforms = gui.uniforms();
            // console.log('GuiService.onUpdate', uniforms);
            // uniforms.u_trails = trails;
            // uniforms.u_trail_0 = trails[0];
            glsl.setUniforms(uniforms);
            // console.log('onUpdateUniforms', uniforms);
        }

        var gui = new GuiService(onUpdateUniforms);

        load();

        function load() {
            document.querySelector('.errors').setAttribute('class', 'errors');
            document.querySelector('.welcome').setAttribute('class', (options.uri ? 'welcome' : 'welcome active'));
            var o = window.options;
            o.vertex = o.vertex.trim().length > 0 ? o.vertex : null;
            o.fragment = o.fragment.trim().length > 0 ? o.fragment : null;
            if (o.fragment || o.vertex) {
                document.querySelector('body').setAttribute('class', 'ready');
            } else {
                document.querySelector('body').setAttribute('class', 'empty');
                removeStats();
            }
            glsl.load(o.fragment, o.vertex);
            for (var t in o.textures) {
                glsl.uniformTexture('u_texture_' + t, o.textures[t], {
                    filtering: 'mipmap',
                    repeat: true,
                });
            }
            gui.load(o.uniforms);
            glsl.setUniforms(gui.uniforms());
        }

        function resize(init) {
            var w = content.offsetWidth;
            var h = content.offsetHeight;
            canvas.style.width = w + 'px';
            canvas.style.height = h + 'px';
            if (init) {
                canvas.width = w;
                canvas.height = h;
            } else {
                glsl.resize();
            }
        }

        function snapshot() {
            glsl.forceRender = true;
            glsl.render();
            return capture.snapshot();
        }

        function record() {
            glsl.forceRender = true;
            glsl.render();
            if (capture.record()) {
                // flags.record = true;
            }
        }

        function stop() {
            capture.stop().then(function (video) {
                // console.log('capture.stop');
                // var filename = options.uri.path.split('/').pop().replace('.glsl', '');
                // console.log('filename', filename);
                var url = URL.createObjectURL(video.blob);
                var link = document.createElement('a');
                link.href = url;
                link.download = 'shader' + video.extension;
                link.click();
                setTimeout(function () {
                    window.URL.revokeObjectURL(output);
                }, 100);
            });
        }

        function togglePause() {
            flags.pause = !flags.pause;
            // console.log('pause', flags.pause);
            if (glsl.paused) {
                if (glsl.timePause) {
                    glsl.timePrev = new Date();
                    glsl.timeLoad += (glsl.timePrev - glsl.timePause);
                }
                glsl.play();
                buttons.pause.querySelector('i').setAttribute('class', 'icon-pause');
            } else {
                glsl.pause();
                glsl.timePause = new Date();
                buttons.pause.querySelector('i').setAttribute('class', 'icon-play');
            }
        }

        function toggleRecord() {
            flags.record = !flags.record;
            // console.log('record', flags.record);
            if (flags.record) {
                buttons.record.setAttribute('class', 'btn btn-record active');
                buttons.record.querySelector('i').setAttribute('class', 'icon-stop');
                record();
            } else {
                buttons.record.setAttribute('class', 'btn btn-record');
                buttons.record.querySelector('i').setAttribute('class', 'icon-record');
                stop();
            }
        }

        function toggleStats() {
            flags.stats = !flags.stats;

            function statsTick() {
                stats.update();
                if (flags.stats) {
                    requestAnimationFrame(statsTick);
                }
            }
            if (flags.stats) {
                if (!statsdom) {
                    stats = new Stats();
                    stats.showPanel(0); // 0: fps, 1: ms, 2: mb, 3+: custom
                    statsdom = stats.dom;
                    statsdom.setAttribute('class', 'stats');
                    // statsdom.style.cssText = 'position:fixed;top:0;right:0;cursor:pointer;opacity:0.9;z-index:10000';
                    document.body.appendChild(stats.dom);
                } else {
                    statsdom.style.visibility = 'visible';
                }
                requestAnimationFrame(statsTick);
                gui.show();
                buttons.stats.setAttribute('class', 'btn btn-stats active');
            } else {
                removeStats();
            }
        }

        function removeStats() {
            if (statsdom) {
                statsdom.style.visibility = 'hidden';
            }
            gui.hide();
            buttons.stats.setAttribute('class', 'btn btn-stats');
            flags.stats = false;
        }

        function createShader(e) {
            // console.log('createShader', e);
            window.parent.postMessage({
                command: "did-click-link",
                data: 'command:glsl-canvas.createShader?' + JSON.stringify([options.uri]),
            }, "file://");
        }

        function onMessage(event) {
            window.options = JSON.parse(event.data);
            // console.log('onMessage', window.options);
            // event.source.postMessage('message', event.origin);
            load();
        }

        var ri;

        function onResize() {
            if (ri) {
                clearTimeout(ri);
            }
            ri = setTimeout(resize, 50);
        }

        var ui;

        function updateUniforms(e) {
            if (ui) {
                clearTimeout(ui);
            }
            ui = setTimeout(function () {
                onUpdateUniforms();
            }, 1000 / 25);
        }

        function onDown(e) {
            var min = Math.min(content.offsetWidth, content.offsetHeight);
            camera.down(e.x / min, e.y / min);
        }

        function onMove(e) {
            var min = Math.min(content.offsetWidth, content.offsetHeight);
            camera.move(e.x / min, e.y / min);
            trails.move(e.x, content.offsetHeight - e.y);
        }

        function onUp(e) {
            var min = Math.min(content.offsetWidth, content.offsetHeight);
            camera.up(e.x / min, e.y / min);
        }

        function onWheel(e) {
            camera.wheel(e.wheelDelta / Math.abs(e.wheelDelta));
        }

        canvas.addEventListener("dblclick", togglePause);
        canvas.addEventListener('mousedown', onDown);
        canvas.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
        window.addEventListener('mousewheel', onWheel);
        buttons.pause.addEventListener('mousedown', togglePause);
        buttons.record.addEventListener('mousedown', toggleRecord);
        buttons.stats.addEventListener('mousedown', toggleStats);
        buttons.create.addEventListener('click', createShader);
        window.addEventListener("message", onMessage, false);
        window.addEventListener('resize', onResize);

        resize();
    }

    function onGlslError(message) {
        // console.log('onGlslError.error', message.error);
        var options = window.options;
        var errors = [],
            warnings = [];
        message.error.replace(/ERROR: \d+:(\d+): \'(.+)\' : (.+)/g, function (m, l, v, t) {
            var message = 'ERROR (' + v + ') ' + t;
            var li = '<li><a class="error" unselectable href="' + encodeURI('command:glsl-canvas.revealGlslLine?' + JSON.stringify([options.uri, Number(l), message])) + '"><span class="line">ERROR line ' + Number(l) + '</span> <span class="value" title="' + v + '">' + v + '</span> <span class="text" title="' + t + '">' + t + '</span></a></li>';
            errors.push(li);
            return li;
        });
        message.error.replace(/WARNING: \d+:(\d+): \'(.*\n*|.*|\n*)\' : (.+)/g, function (m, l, v, t) {
            var li = '<li><a class="warning" unselectable href="' + encodeURI('command:glsl-canvas.revealGlslLine?' + JSON.stringify([options.uri, Number(l), message])) + '"><span class="line">WARN line ' + Number(l) + '</span> <span class="text" title="' + t + '">' + t + '</span></a></li>';
            warnings.push(li);
            return li;
        });
        var output = '<div class="errors-content"><p>glslCanvas error</p><ul>';
        output += errors.join('\n');
        output += warnings.join('\n');
        output += '</ul></div>';
        document.querySelector('.errors').setAttribute('class', 'errors active');
        document.querySelector('.errors').innerHTML = output;
        document.querySelector('body').setAttribute('class', 'idle');
    }

    window.addEventListener('load', onLoad);

}());