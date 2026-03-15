import { useEffect, useMemo, useState } from 'react';

const VIDEO_EXTS = new Set(['mp4', 'mkv', 'mov', 'avi', 'webm', 'm4v']);
const IMAGE_EXTS = new Set(['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp']);

const formatBytes = (bytes) => {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const power = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** power).toFixed(2)} ${units[power]}`;
};

const fileTypeFor = (file) => {
  if (file.isDirectory) return 'Folder';
  if (VIDEO_EXTS.has(file.extension)) return 'Video';
  if (IMAGE_EXTS.has(file.extension)) return 'Image';
  return 'Other';
};

function App() {
  const [destination, setDestination] = useState('gdrive:Videos');
  const [files, setFiles] = useState([]);
  const [filter, setFilter] = useState('All');
  const [selected, setSelected] = useState(new Set());
  const [activeIndex, setActiveIndex] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [queueIndex, setQueueIndex] = useState(-1);
  const [progress, setProgress] = useState('Waiting');
  const [logs, setLogs] = useState([]);

  useEffect(() => {
    const offLog = window.uploaderApi.onUploadLog((line) => {
      setLogs((prev) => [line, ...prev].slice(0, 150));
    });
    const offError = window.uploaderApi.onUploadErrorLog((line) => {
      setLogs((prev) => [`ERROR: ${line}`, ...prev].slice(0, 150));
    });
    const offProgress = window.uploaderApi.onUploadProgress((json) => {
      if (json.stats) {
        const pct = json.stats.percentage ? `${json.stats.percentage}` : '0%';
        setProgress(`${pct} • ${json.stats.speed || 'n/a'} • ${json.stats.transferring?.length || 0} active`);
      }
    });

    return () => {
      offLog();
      offError();
      offProgress();
    };
  }, []);

  const visibleFiles = useMemo(() => {
    const filtered = files.filter((file) => {
      if (filter === 'All') return true;
      if (filter === 'Videos') return fileTypeFor(file) === 'Video';
      if (filter === 'Images') return fileTypeFor(file) === 'Image';
      return true;
    });
    return filtered.sort((a, b) => b.size - a.size);
  }, [files, filter]);

  const selectedItems = useMemo(
    () => visibleFiles.filter((f) => selected.has(f.path)),
    [visibleFiles, selected]
  );

  const openPicker = async () => {
    const result = await window.uploaderApi.openPicker();
    if (result.canceled || !result.filePaths?.length) return;
    const meta = await window.uploaderApi.inspectPaths(result.filePaths);
    setFiles(meta);
    setSelected(new Set(meta.map((f) => f.path)));
    setActiveIndex(null);
    setLogs([]);
  };

  const handleRowSelect = (index, event) => {
    const target = visibleFiles[index];
    const next = new Set(selected);

    if (event.shiftKey && activeIndex !== null) {
      const start = Math.min(activeIndex, index);
      const end = Math.max(activeIndex, index);
      for (let i = start; i <= end; i += 1) next.add(visibleFiles[i].path);
    } else if (event.ctrlKey || event.metaKey) {
      if (next.has(target.path)) next.delete(target.path);
      else next.add(target.path);
      setActiveIndex(index);
    } else {
      next.clear();
      next.add(target.path);
      setActiveIndex(index);
    }

    setSelected(next);
  };

  const uploadQueue = async () => {
    const queue = selectedItems;
    if (!queue.length) return;

    setUploading(true);
    setQueueIndex(0);
    setProgress('Starting...');

    for (let i = 0; i < queue.length; i += 1) {
      const item = queue[i];
      setQueueIndex(i);
      setProgress(`Uploading ${item.name}`);
      // eslint-disable-next-line no-await-in-loop
      await window.uploaderApi.startUploadItem({ source: item.path, destination });
      // eslint-disable-next-line no-await-in-loop
      await new Promise((resolve) => {
        const off = window.uploaderApi.onUploadFinished((code) => {
          if (code !== 0) {
            setLogs((prev) => [`Upload for ${item.name} exited with code ${code}`, ...prev]);
          }
          off();
          resolve();
        });
      });
    }

    setProgress('Completed');
    setUploading(false);
    setQueueIndex(-1);
  };

  const cancelUpload = async () => {
    await window.uploaderApi.cancelUpload();
    setUploading(false);
    setProgress('Cancelled');
  };

  return (
    <main>
      <h1>Upload2GDrive</h1>
      <p className="sub">Rclone move uploader with chunking, parallelism, resumable sessions.</p>

      <section className="controls">
        <button onClick={openPicker} disabled={uploading}>Browse Files/Folders (default ~/Downloads)</button>
        <label>
          Filter:
          <select value={filter} onChange={(e) => setFilter(e.target.value)} disabled={uploading}>
            <option>All</option>
            <option>Videos</option>
            <option>Images</option>
          </select>
        </label>
        <label className="dest">
          Destination:
          <input value={destination} onChange={(e) => setDestination(e.target.value)} disabled={uploading} />
        </label>
        <button onClick={uploadQueue} disabled={uploading || selectedItems.length === 0}>Start Move Upload</button>
        <button onClick={cancelUpload} disabled={!uploading}>Cancel</button>
      </section>

      <section className="status">
        <div>Selected: {selectedItems.length} / {visibleFiles.length}</div>
        <div>Sort: Size (largest first)</div>
        <div>Progress: {progress}</div>
        {uploading && queueIndex >= 0 && <div>Queue Position: {queueIndex + 1} / {selectedItems.length}</div>}
      </section>

      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Type</th>
            <th>Size</th>
            <th>Path</th>
          </tr>
        </thead>
        <tbody>
          {visibleFiles.map((file, index) => {
            const type = fileTypeFor(file);
            return (
              <tr
                key={file.path}
                className={selected.has(file.path) ? 'selected' : ''}
                onClick={(event) => handleRowSelect(index, event)}
              >
                <td>{file.name}</td>
                <td>{type}</td>
                <td>{formatBytes(file.size)}</td>
                <td>{file.path}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <section className="logs">
        <h2>Live Logs</h2>
        <pre>{logs.join('\n')}</pre>
      </section>
    </main>
  );
}

export default App;
