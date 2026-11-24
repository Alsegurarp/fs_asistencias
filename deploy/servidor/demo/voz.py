# Sintetiza la voz de los videos con Piper, sin conexión. Carga el modelo una
# sola vez y atiende pedidos por la entrada estándar, uno por línea:
#   {"texto": "...", "archivo": "/ruta/salida.wav"}
# Responde una línea por pedido: {"archivo": "..."} o {"error": "..."}.
import json
import sys
import wave

from piper import PiperVoice

voz = PiperVoice.load(sys.argv[1])
print(json.dumps({"listo": True}), flush=True)
for linea in sys.stdin:
    linea = linea.strip()
    if not linea:
        continue
    pedido = json.loads(linea)
    try:
        with wave.open(pedido["archivo"], "wb") as salida:
            if hasattr(voz, "synthesize_wav"):
                voz.synthesize_wav(pedido["texto"], salida)
            else:
                voz.synthesize(pedido["texto"], salida)
        print(json.dumps({"archivo": pedido["archivo"]}), flush=True)
    except Exception as error:  # se informa la clase, sin el texto
        print(json.dumps({"error": type(error).__name__}), flush=True)
