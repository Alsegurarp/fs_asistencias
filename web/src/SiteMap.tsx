import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { Box } from '@mui/material'
import { color } from './design'

export type MapSite = { id: string; name: string; latitude: number; longitude: number; radiusMeters: number; active: boolean }

type Props = {
  /** Las sedes, cada una con su círculo de marcaje. */
  sites: MapSite[]
  /** Abre una sede al tocar su círculo. */
  onSelect?: (id: string) => void
  /** La sede que se edita: su punto se arrastra y su círculo sigue al radio. */
  editing?: { latitude: number; longitude: number; radiusMeters: number } | null
  onMove?: (latitude: number, longitude: number) => void
  label: string
  height?: number
}

const tiles = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
const attribution = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'

/** El punto que se arrastra, sin imágenes: sólo CSS, para no abrir la política a otros orígenes. */
const pin = L.divIcon({
  className: 'zenit-pin', iconSize: [22, 22], iconAnchor: [11, 11],
  html: `<span style="display:block;width:22px;height:22px;border-radius:50%;background:${color.accent};border:3px solid ${color.white};box-shadow:0 2px 6px rgba(18,35,63,.35)"></span>`,
})

/**
 * Mapa de sedes con OpenStreetMap (decisión del 10 nov). Las cifras y la
 * edición siempre tienen su alternativa en la tabla y en latitud y longitud:
 * el mapa es una ayuda, no el único camino.
 */
export default function SiteMap({ sites, onSelect, editing, onMove, label, height = 260 }: Props) {
  const box = useRef<HTMLDivElement>(null)
  const map = useRef<L.Map | null>(null)
  const layer = useRef<L.LayerGroup | null>(null)
  const marker = useRef<L.Marker | null>(null)
  const circle = useRef<L.Circle | null>(null)
  const fitted = useRef(false)
  const moved = useRef(onMove)
  const selected = useRef(onSelect)
  moved.current = onMove
  selected.current = onSelect

  useEffect(() => {
    if (!box.current) return
    const created = L.map(box.current, { zoomControl: true, attributionControl: true }).setView([23.6, -102.5], 5)
    created.zoomControl.getContainer()?.querySelectorAll('a').forEach(link => {
      link.setAttribute('aria-label', link.classList.contains('leaflet-control-zoom-in') ? 'Acercar el mapa' : 'Alejar el mapa')
    })
    created.attributionControl.setPrefix(false)
    L.tileLayer(tiles, { maxZoom: 19, attribution }).addTo(created)
    layer.current = L.layerGroup().addTo(created)
    map.current = created
    return () => { created.remove(); map.current = null; layer.current = null; marker.current = null; circle.current = null; fitted.current = false }
  }, [])

  // Las demás sedes: un círculo por sede; el de la que se edita lo dibuja abajo.
  useEffect(() => {
    const group = layer.current
    const current = map.current
    if (!group || !current) return
    group.clearLayers()
    for (const site of sites) {
      const shape = L.circle([site.latitude, site.longitude], {
        radius: site.radiusMeters, color: site.active ? color.accent : color.subtle, weight: 2,
        fillColor: site.active ? color.accent : color.subtle, fillOpacity: editing ? 0.06 : 0.14, dashArray: site.active ? undefined : '4 4',
      }).bindTooltip(`${site.name} · ${site.radiusMeters} m`)
      if (selected.current) shape.on('click', () => selected.current?.(site.id))
      shape.addTo(group)
    }
    if (!editing && !fitted.current && sites.length) {
      const bounds = L.latLngBounds([])
      for (const site of sites) bounds.extend(L.latLng(site.latitude, site.longitude).toBounds(site.radiusMeters * 4))
      current.fitBounds(bounds, { maxZoom: 16, padding: [24, 24] })
      fitted.current = true
    }
  }, [sites, editing])

  // La sede que se edita: el punto arrastrable y su círculo.
  const lat = editing?.latitude
  const lng = editing?.longitude
  const radius = editing?.radiusMeters
  useEffect(() => {
    const current = map.current
    if (!current) return
    if (lat === undefined || lng === undefined || radius === undefined || !Number.isFinite(lat) || !Number.isFinite(lng)) {
      marker.current?.remove(); circle.current?.remove(); marker.current = null; circle.current = null
      return
    }
    const point = L.latLng(lat, lng)
    const size = Number.isFinite(radius) ? Math.min(Math.max(radius, 20), 2000) : 100
    if (!marker.current) {
      marker.current = L.marker(point, { icon: pin, draggable: true, keyboard: false, title: 'Punto de la sede' }).addTo(current)
      marker.current.on('drag', event => circle.current?.setLatLng((event.target as L.Marker).getLatLng()))
      marker.current.on('dragend', event => { const at = (event.target as L.Marker).getLatLng(); moved.current?.(Number(at.lat.toFixed(6)), Number(at.lng.toFixed(6))) })
      circle.current = L.circle(point, { radius: size, color: color.accent, weight: 2, fillColor: color.accent, fillOpacity: 0.18, interactive: false }).addTo(current)
      current.setView(point, 16)
    } else {
      if (!marker.current.getLatLng().equals(point)) { marker.current.setLatLng(point); current.panTo(point) }
      circle.current?.setLatLng(point)
      circle.current?.setRadius(size)
    }
  }, [lat, lng, radius])

  return <Box ref={box} role="region" aria-label={label}
    sx={{ height, width: '100%', borderRadius: '14px', overflow: 'hidden', border: `1px solid ${color.line}`, background: color.page, zIndex: 0,
      '& .leaflet-container': { fontFamily: 'inherit' }, '& .zenit-pin': { background: 'transparent', border: 0 } }} />
}
