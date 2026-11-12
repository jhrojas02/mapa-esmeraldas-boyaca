# Zonas de potencial esmeraldífero · Occidente de Boyacá

Aplicación web (versión preliminar) del **Modelo A** de la tesis *Algoritmos de mapeo inteligente de zonas de
exploración esmeraldífera en el occidente de Boyacá* (Ciencia de Datos, Universidad Externado de Colombia).

Permite:
- ver el mapa de zonas de potencial (alto / incierto / bajo, con su nivel de confianza) sobre imagen satelital;
- buscar un pueblo, vereda o municipio, o usar la ubicación del teléfono, y ver qué zona hay en ese punto, cómo se
  reparte el territorio a menos de 5 km y cuáles son las áreas de potencial alto más cercanas;
- recorrer la lista de municipios y acercarse a cada uno.

**Qué significa:** “potencial alto” quiere decir que la zona se parece geológicamente a donde hoy hay minas de
esmeralda; no garantiza que haya esmeralda. El mapa no muestra la ubicación de minas. El Modelo A todavía no incluye
el conocimiento de los mineros.

**Cómo se generó:** modelo bayesiano jerárquico (presencia-fondo) ajustado con inferencia variacional (ADVI) sobre
celdas de 250 m, con geología 1:100.000 del Servicio Geológico Colombiano, Copernicus DEM, Sentinel-2, ESA WorldCover,
geoquímica de sedimentos (Mantilla et al., 2007) y OpenStreetMap. Los datos de `data/` los produce el cuaderno
`notebooks/03_modelo_A_vi.ipynb` del repositorio de la tesis.

Es una página estática (HTML, CSS y JavaScript con Leaflet); no tiene servidor ni recoge datos de quien la usa.
