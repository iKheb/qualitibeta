import React, { useMemo, useState } from 'react';
import { Activity, ClipboardList, Edit3, Plus, Search, Trash2 } from 'lucide-react';

const normalize = (value) => String(value || '').toLowerCase().trim();

const FIELD_LABELS = {
  nombre: 'Nombre',
  apellido: 'Apellido',
  cedula: 'Cedula',
  telefono: 'Telefono',
  direccion: 'Direccion',
  recibido_por: 'Recibido por',
  marca: 'Marca',
  modelo: 'Modelo',
  reparacion: 'Reparacion',
  observaciones: 'Observaciones',
  dias_garantia: 'Dias de garantia',
  precio: 'Precio',
  clave_equipo: 'PIN / clave',
  patron_equipo: 'Patron',
  estado: 'Estado',
  estado_recepcion: 'Condicion de recepcion',
  fotos: 'Fotos',
  fecha_entregado: 'Fecha de entrega',
};

const getFieldLabel = (field) => FIELD_LABELS[field] || field.replaceAll('_', ' ');

const formatLogValue = (field, value) => {
  if (value === null || value === undefined || value === '') return 'Sin dato';
  if (field === 'patron_equipo') return Array.isArray(value) ? value.join('-') : value || 'Sin patron';
  if (field === 'fotos') return Array.isArray(value) ? `${value.length} foto(s)` : 'Fotos actualizadas';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
};

const formatDate = (value) => {
  if (!value) return 'Sin fecha';
  return new Intl.DateTimeFormat('es-CO', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value));
};

const formatDateTime = (value) => {
  if (!value) return '';
  const date = new Date(value);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  const hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'pm' : 'am';
  const hours12 = hours % 12 || 12;
  return ` el ${day}-${month}-${year} a las ${hours12}:${minutes} ${ampm}`;
};

const METADATA_FIELDS = ['updated_at', 'fecha_actualizacion', 'fecha_ingreso', 'created_at', 'fecha', 'table_name', 'repair_id', 'expense_id'];

function LogsView({ logs }) {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredLogs = useMemo(() => {
    const query = normalize(searchTerm);
    if (!query) return logs;
    return logs.filter((log) => {
      const haystack = [
        log.repair_label || '',
        log.action || '',
        JSON.stringify(log.changed_fields || {}),
      ].map(normalize).join(' ');
      return haystack.includes(query);
    });
  }, [logs, searchTerm]);

  const getActionIcon = (action) => {
    switch (action) {
      case 'created':
        return <Plus size={16} />;
      case 'updated':
        return <Edit3 size={16} />;
      case 'deleted':
        return <Trash2 size={16} />;
      case 'status_changed':
        return <Activity size={16} />;
      default:
        return <ClipboardList size={16} />;
    }
  };

  const getActionColor = (action) => {
    switch (action) {
      case 'created':
        return 'text-green-400';
      case 'updated':
        return 'text-blue-400';
      case 'deleted':
        return 'text-red-400';
      case 'status_changed':
        return 'text-yellow-400';
      default:
        return 'text-gray-400';
    }
  };

  const formatChangedFields = (changedFields, logDate) => {
    if (!changedFields || Object.keys(changedFields).length === 0) return null;
    const dateTimeStr = formatDateTime(logDate);
    return Object.entries(changedFields)
      .filter(([field]) => !METADATA_FIELDS.includes(field))
      .map(([field, values]) => (
        <div key={field} className="log-change">
          <span className="log-field">{getFieldLabel(field)}:</span>
          <span className="log-old">{formatLogValue(field, values.old)}</span>
          <span className="log-arrow">→</span>
          <span className="log-new">{formatLogValue(field, values.new)}{dateTimeStr}</span>
        </div>
      ));
  };

  return (
    <section className="view-stack">
      <div className="view-header">
        <div>
          <h1>Registro de cambios</h1>
          <p>{filteredLogs.length} registros de actividad</p>
        </div>
        <div className="search-box">
          <Search size={17} />
          <input
            type="search"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Buscar en logs..."
          />
        </div>
      </div>

      <div className="logs-container">
        {filteredLogs.length === 0 && <div className="empty-state">No hay registros de cambios.</div>}
        {filteredLogs.map((log) => (
          <article key={log.id} className="log-entry">
            <div className="log-header">
              <div className="log-action-badge">
                {getActionIcon(log.action)}
                <span className={getActionColor(log.action)}>{log.action}</span>
              </div>
              <time className="log-time">{formatDate(log.created_at)}</time>
            </div>
            
            <div className="log-content">
              <h3 className="log-repair-label">{log.repair_label || 'Equipo sin nombre'}</h3>
              
              {log.action === 'created' && (
                <p className="log-message">Se creó un nuevo registro de servicio técnico.</p>
              )}
              
              {log.action === 'deleted' && (
                <p className="log-message">Se eliminó el registro de servicio técnico.</p>
              )}
              
              {log.action === 'updated' && (
                <div className="log-changes">
                  <p className="log-message">Se actualizaron los siguientes campos:</p>
                  {formatChangedFields(log.changed_fields, log.created_at)}
                </div>
              )}
              
              {log.action === 'status_changed' && (
                <div className="log-changes">
                  <p className="log-message">Cambio de estado:</p>
                  {formatChangedFields(log.changed_fields, log.created_at)}
                </div>
              )}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

export default LogsView;
