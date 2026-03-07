import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { WidgetRenderProps } from '../../../entities/widget/model/types';
import { Button } from '../../../shared/ui/Button';
import { IconButton } from '../../../shared/ui/IconButton';
import styles from './TranscribeWidget.module.scss';

type BrowserEntry = {
  name: string;
  path: string;
  type: 'dir' | 'file';
};

const transcribeLastPathKey = 'yulia:last-transcribe-path';
const transcribeRecentPathsKey = 'yulia:transcribe-recent-paths';
const transcribeSelectedFilesKey = 'yulia:last-transcribe-selected-files';
const defaultBrowsePath = 'C:\\Users\\julia\\OneDrive\\Рабочий стол';

function getStoredSelectedAudioFiles() {
  const raw = localStorage.getItem(transcribeSelectedFilesKey);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((value): value is string => typeof value === 'string' && value.trim().length > 0);
  } catch {
    return [];
  }
}

function persistSelectedAudioFiles(paths: string[]) {
  if (paths.length === 0) {
    localStorage.removeItem(transcribeSelectedFilesKey);
    return;
  }
  localStorage.setItem(transcribeSelectedFilesKey, JSON.stringify(paths));
}

function getRecentPaths() {
  const raw = localStorage.getItem(transcribeRecentPathsKey);
  if (!raw) return [] as string[];

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((entry): entry is string => typeof entry === 'string').slice(-8);
  } catch {
    return [];
  }
}

function rememberPath(pathValue: string) {
  if (!pathValue) return;
  localStorage.setItem(transcribeLastPathKey, pathValue);
  const next = getRecentPaths().filter((entry) => entry !== pathValue);
  next.push(pathValue);
  while (next.length > 8) next.shift();
  localStorage.setItem(transcribeRecentPathsKey, JSON.stringify(next));
}

function parseSseEventChunk(rawEvent: string) {
  const lines = rawEvent.split('\n');
  let eventName = 'message';
  const dataLines: string[] = [];

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    if (line.startsWith('event:')) {
      eventName = line.slice(6).trim();
    } else if (line.startsWith('data:')) {
      dataLines.push(line.slice(5).trimStart());
    }
  }

  if (dataLines.length === 0) {
    return null;
  }

  try {
    const payload = JSON.parse(dataLines.join('\n')) as Record<string, unknown>;
    return {
      eventName,
      payload
    };
  } catch {
    return null;
  }
}

function formatSelectedAudioFiles(paths: string[]) {
  if (paths.length === 0) return '—';
  return paths
    .map((filePath, index) => `${index + 1}. ${filePath.split(/[\\/]/).pop() ?? filePath}`)
    .join(' • ');
}

export function TranscribeWidget(_props: WidgetRenderProps) {
  const themeClass = _props.theme === 'night' ? styles.night : styles.day;
  const [browsePath, setBrowsePath] = useState('');
  const [recentPaths, setRecentPaths] = useState<string[]>([]);
  const [entries, setEntries] = useState<BrowserEntry[]>([]);
  const [selectedFolderPath, setSelectedFolderPath] = useState<string | null>(null);
  const [selectedAudioFiles, setSelectedAudioFiles] = useState<string[]>([]);
  const [selectedTranscriptPath, setSelectedTranscriptPath] = useState<string | null>(null);
  const [status, setStatus] = useState('Открой папку и выбери .m4a файлы для транскрибации.');
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState('');
  const [resultVisible, setResultVisible] = useState(false);
  const [resultText, setResultText] = useState('');
  const [actionsLocked, setActionsLocked] = useState(false);
  const [lastTranscriptFileName, setLastTranscriptFileName] = useState('');
  const typewriterQueueRef = useRef('');
  const typewriterTimerRef = useRef<number | null>(null);
  const resultTextRef = useRef('');

  const selectedAudioText = useMemo(() => formatSelectedAudioFiles(selectedAudioFiles), [selectedAudioFiles]);

  useEffect(() => {
    resultTextRef.current = resultText;
  }, [resultText]);

  useEffect(() => {
    return () => {
      if (typewriterTimerRef.current !== null) {
        window.clearTimeout(typewriterTimerRef.current);
        typewriterTimerRef.current = null;
      }
      window.speechSynthesis.cancel();
    };
  }, []);

  const getVisibleM4aFilePaths = useCallback((sourceEntries = entries) => {
    return sourceEntries
      .filter((entry) => entry.type === 'file' && entry.name.toLowerCase().endsWith('.m4a'))
      .map((entry) => entry.path);
  }, [entries]);

  const getFirstVisibleTranscriptTxtPath = useCallback((sourceEntries = entries) => {
    const txtEntry = sourceEntries.find((entry) => entry.type === 'file' && entry.name.toLowerCase().endsWith('.txt'));
    return txtEntry?.path ?? null;
  }, [entries]);

  const syncRecentPaths = useCallback(() => {
    setRecentPaths([...getRecentPaths()].reverse());
  }, []);

  const openSetupView = () => {
    if (typewriterTimerRef.current !== null) {
      window.clearTimeout(typewriterTimerRef.current);
      typewriterTimerRef.current = null;
    }
    typewriterQueueRef.current = '';
    setActionsLocked(false);
    setResultVisible(false);
  };

  const runTypewriter = () => {
    if (!typewriterQueueRef.current.length) {
      typewriterTimerRef.current = null;
      setActionsLocked(false);
      return;
    }

    const remaining = typewriterQueueRef.current.length;
    const batchSize = remaining > 220 ? 14 : remaining > 120 ? 10 : remaining > 40 ? 6 : 3;

    const chunk = typewriterQueueRef.current.slice(0, batchSize);
    typewriterQueueRef.current = typewriterQueueRef.current.slice(batchSize);

    setResultText((prev) => {
      const next = prev + chunk;
      resultTextRef.current = next;
      return next;
    });
    typewriterTimerRef.current = window.setTimeout(runTypewriter, 22);
  };

  const ensureTypewriterRunning = () => {
    if (typewriterTimerRef.current !== null) return;
    typewriterTimerRef.current = window.setTimeout(runTypewriter, 22);
  };

  const setSelectedFiles = useCallback((next: string[], shouldPersist = true, sourceEntries = entries) => {
    const visiblePaths = new Set(getVisibleM4aFilePaths(sourceEntries).map((value) => value.toLowerCase()));
    const unique = next.filter((value, index, source) => {
      const normalized = value.toLowerCase();
      return visiblePaths.has(normalized) && source.findIndex((candidate) => candidate.toLowerCase() === normalized) === index;
    });

    setSelectedAudioFiles(unique);

    if (shouldPersist) {
      persistSelectedAudioFiles(unique);
    }

    setSelectedTranscriptPath(getFirstVisibleTranscriptTxtPath(sourceEntries));
  }, [entries, getFirstVisibleTranscriptTxtPath, getVisibleM4aFilePaths]);

  const loadPathEntries = useCallback(async (inputPath: string) => {
    const value = inputPath.trim();
    if (!value) {
      setStatus('Вставь путь к папке.');
      return;
    }

    setLoading(true);
    setStatus('Загружаю содержимое...');

    try {
      const response = await fetch('/api/widget/com.yulia.transcribe/fs-list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: value })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || 'Не удалось прочитать путь.');
      }

      const nextEntries = data.entries as BrowserEntry[];
      setEntries(nextEntries);
      setBrowsePath(data.path as string);
      rememberPath(data.path as string);
      syncRecentPaths();
      setSelectedFolderPath(data.path as string);

      const savedSelection = getStoredSelectedAudioFiles();
      setSelectedFiles(savedSelection, false, nextEntries);
      setSelectedTranscriptPath(nextEntries.find((entry) => entry.type === 'file' && entry.name.toLowerCase().endsWith('.txt'))?.path ?? null);

      const hasM4a = nextEntries.some((entry) => entry.type === 'file' && entry.name.toLowerCase().endsWith('.m4a'));
      setStatus(hasM4a
        ? savedSelection.length > 0
          ? `Папка открыта. Восстановлено файлов: ${savedSelection.length}.`
          : 'Папка открыта. Выбери один или несколько .m4a файлов.'
        : 'Папка открыта, но .m4a файлов не найдено.');
    } catch (error) {
      setEntries([]);
      setSelectedFolderPath(null);
      setSelectedFiles([], false);
      setSelectedTranscriptPath(null);
      setStatus(`Ошибка: ${error instanceof Error ? error.message : 'Ошибка чтения пути.'}`);
    } finally {
      setLoading(false);
    }
  }, [setSelectedFiles, syncRecentPaths]);

  useEffect(() => {
    const savedPath = localStorage.getItem(transcribeLastPathKey) ?? defaultBrowsePath;
    setBrowsePath(savedPath);
    setRecentPaths([...getRecentPaths()].reverse());
    void loadPathEntries(savedPath);
  }, [loadPathEntries]);

  const toggleSelectedAudioFile = (filePath: string) => {
    const currentIndex = selectedAudioFiles.findIndex((value) => value.toLowerCase() === filePath.toLowerCase());
    if (currentIndex >= 0) {
      const next = [...selectedAudioFiles];
      next.splice(currentIndex, 1);
      setSelectedFiles(next);
      return false;
    }

    setSelectedFiles([...selectedAudioFiles, filePath]);
    return true;
  };

  const onTranscribe = async () => {
    if (!selectedFolderPath) {
      setStatus('Сначала открой папку.');
      return;
    }

    if (selectedAudioFiles.length === 0) {
      setStatus('Сначала выбери хотя бы один .m4a файл.');
      return;
    }

    setLoading(true);
    setProgress(1);
    setProgressLabel('Запуск...');
    setStatus('Идет процесс транскрибации...');
    setResultVisible(true);
    setResultText('');
    resultTextRef.current = '';
    typewriterQueueRef.current = '';
    setActionsLocked(true);

    try {
      const response = await fetch('/api/widget/com.yulia.transcribe/transcribe-stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          folderPath: selectedFolderPath,
          filePaths: selectedAudioFiles
        })
      });

      if (!response.ok || !response.body) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || 'Транскрибация не удалась.');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let finished = false;
      let finalTranscript = '';
      let savePath = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true }).replace(/\r/g, '');

        while (true) {
          const boundary = buffer.indexOf('\n\n');
          if (boundary === -1) break;

          const chunk = buffer.slice(0, boundary);
          buffer = buffer.slice(boundary + 2);
          const parsed = parseSseEventChunk(chunk);
          if (!parsed) continue;

          if (parsed.eventName === 'progress') {
            const percent = typeof parsed.payload.percent === 'number' ? parsed.payload.percent : 0;
            const stage = typeof parsed.payload.stage === 'string' ? parsed.payload.stage : '';
            setProgress(Math.max(0, Math.min(100, Math.round(percent))));
            setProgressLabel(stage);
            continue;
          }

          if (parsed.eventName === 'token') {
            const text = typeof parsed.payload.text === 'string' ? parsed.payload.text : '';
            if (text) {
              typewriterQueueRef.current += text;
              setStatus('Gemini печатает стенограмму...');
              ensureTypewriterRunning();
            }
            continue;
          }

          if (parsed.eventName === 'done') {
            finished = true;
            finalTranscript = typeof parsed.payload.transcript === 'string' ? parsed.payload.transcript : '';
            savePath = typeof parsed.payload.savePath === 'string' ? parsed.payload.savePath : '';
              if (finalTranscript) {
              const known = resultTextRef.current + typewriterQueueRef.current;
              if (finalTranscript.startsWith(known)) {
                typewriterQueueRef.current += finalTranscript.slice(known.length);
              } else {
                setResultText('');
                resultTextRef.current = '';
                typewriterQueueRef.current = finalTranscript;
              }
              ensureTypewriterRunning();
            }
            if (savePath) {
              setSelectedTranscriptPath(savePath);
              setLastTranscriptFileName(savePath.split(/[\\/]/).pop() ?? savePath);
            }
            setProgress(100);
            setProgressLabel('Готово');
            setStatus(savePath ? `Транскрибация закончена: ${savePath.split(/[\\/]/).pop() ?? savePath}` : 'Транскрибация завершена.');
            continue;
          }

          if (parsed.eventName === 'error') {
            throw new Error(typeof parsed.payload.message === 'string' ? parsed.payload.message : 'Ошибка транскрибации.');
          }
        }
      }

      if (!finished) {
        throw new Error('Поток завершился без результата.');
      }
    } catch (error) {
      setActionsLocked(false);
      setStatus(`Ошибка: ${error instanceof Error ? error.message : 'Ошибка транскрибации.'}`);
    } finally {
      setLoading(false);
    }
  };

  const onOpenTxt = async () => {
    if (!selectedTranscriptPath) {
      setStatus('В папке пока нет .txt файла.');
      return;
    }

    setLoading(true);
    setStatus('Открываю готовую стенограмму из .txt...');

    try {
      const response = await fetch('/api/widget/com.yulia.transcribe/transcript-read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ txtPath: selectedTranscriptPath })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || 'Не удалось открыть .txt файл.');
      }

      openSetupView();
      setResultVisible(true);
      setResultText(typeof data.transcript === 'string' ? data.transcript : '');
      setLastTranscriptFileName((data.txtPath as string).split(/[\\/]/).pop() ?? data.txtPath);
      setStatus(`Открыт файл: ${data.txtPath as string}`);
    } catch (error) {
      setStatus(`Ошибка: ${error instanceof Error ? error.message : 'Ошибка чтения .txt.'}`);
    } finally {
      setLoading(false);
    }
  };

  const onReadAloud = () => {
    if (!resultText.trim()) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(resultText);
    utterance.lang = 'ru-RU';
    window.speechSynthesis.speak(utterance);
  };

  const onCopy = async () => {
    if (!resultText.trim()) return;
    try {
      await navigator.clipboard.writeText(resultText);
      setStatus('Текст скопирован.');
    } catch {
      setStatus('Не удалось скопировать текст.');
    }
  };

  const onSave = () => {
    if (!resultText.trim()) return;
    const blob = new Blob([resultText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = lastTranscriptFileName || 'transcript.txt';
    link.click();
    URL.revokeObjectURL(url);
    setStatus('Файл сохранен локально.');
  };

  const onEntryClick = (entry: BrowserEntry) => {
    if (entry.type === 'dir') {
      void loadPathEntries(entry.path);
      return;
    }

    if (!entry.name.toLowerCase().endsWith('.m4a')) {
      setStatus('Выбери файл формата .m4a.');
      return;
    }

    const added = toggleSelectedAudioFile(entry.path);
    const primary = selectedAudioFiles[0] ?? entry.path;
    setStatus(added ? `Добавлен файл: ${entry.name}. Главный файл: ${primary.split(/[\\/]/).pop() ?? primary}.` : `Файл снят: ${entry.name}.`);
  };

  const onUp = () => {
    const current = browsePath.replace(/[\\/]+$/, '');
    if (!current) return;

    const index = current.lastIndexOf('\\');
    if (index <= 2) {
      void loadPathEntries(current);
      return;
    }

    void loadPathEntries(current.slice(0, index));
  };

  const canTranscribe = !loading && selectedFolderPath && selectedAudioFiles.length > 0;

  return (
    <div className={[styles.root, themeClass].join(' ')}>
      {!resultVisible ? (
        <div className={styles.setup}>
          <div className={styles.pathRow}>
            <input
              value={browsePath}
              onChange={(event) => setBrowsePath(event.target.value)}
              list="transcribe-recent-paths"
              placeholder="Вставь путь к папке..."
              disabled={loading}
            />
            <datalist id="transcribe-recent-paths">
              {recentPaths.map((pathValue) => (
                <option key={pathValue} value={pathValue} />
              ))}
            </datalist>
            <IconButton type="button" title="Обновить папку" onClick={() => void loadPathEntries(browsePath)} disabled={loading}>⟳</IconButton>
            <Button type="button" variant="secondary" onClick={onUp} disabled={loading}>Вверх</Button>
            <IconButton
              type="button"
              title="Очистить путь"
              onClick={() => {
                localStorage.removeItem(transcribeLastPathKey);
                localStorage.removeItem(transcribeRecentPathsKey);
                localStorage.removeItem(transcribeSelectedFilesKey);
                setBrowsePath('');
                setEntries([]);
                setSelectedFolderPath(null);
                setSelectedAudioFiles([]);
                setSelectedTranscriptPath(null);
                syncRecentPaths();
                setStatus('Сохраненный путь очищен.');
              }}
              disabled={loading}
            >✕</IconButton>
          </div>

          <p className={styles.mutedInfo}>
            Клик по папке открывает ее содержимое. Клик по `.m4a` добавляет или снимает из очереди. Файлы склеиваются в порядке выбора, затем отправляются в Gemini.
          </p>

          <ul className={styles.browserList}>
            {entries.length === 0 ? <li className={styles.empty}>Папка пустая или пока не открыта.</li> : null}
            {entries.map((entry) => {
              const isM4a = entry.type === 'file' && entry.name.toLowerCase().endsWith('.m4a');
              const selectionOrder = isM4a
                ? selectedAudioFiles.findIndex((value) => value.toLowerCase() === entry.path.toLowerCase())
                : -1;

              return (
                <li key={entry.path}>
                  <button
                    type="button"
                    className={`${styles.browserEntry} ${selectionOrder >= 0 ? styles.selected : ''}`.trim()}
                    onClick={() => onEntryClick(entry)}
                    disabled={loading}
                  >
                    {selectionOrder >= 0 ? `[${selectionOrder + 1}] ` : ''}
                    {entry.type === 'dir' ? '📁' : '📄'} {entry.name}
                  </button>
                </li>
              );
            })}
          </ul>

          <p className={styles.meta}>Текущая папка: <span>{selectedFolderPath ?? '—'}</span></p>
          <p className={styles.meta}>Выбранные файлы: <span>{selectedAudioText}</span></p>

          <div className={styles.progressWrap}>
            <div className={styles.progressBar}>
              <div style={{ width: `${Math.max(0, Math.min(100, progress))}%` }} />
            </div>
            <p>{progress}%{progressLabel ? ` · ${progressLabel}` : ''}</p>
          </div>

          <div className={styles.mainActions}>
            <Button type="button" onClick={onTranscribe} disabled={!canTranscribe}>Транскрибация</Button>
            <Button type="button" variant="secondary" onClick={onOpenTxt} disabled={loading || !selectedTranscriptPath}>Прочитать</Button>
          </div>
        </div>
      ) : (
        <div className={styles.resultBlock}>
          <textarea className={styles.resultText} readOnly value={resultText} />
          <div className={styles.resultActions}>
            <Button type="button" variant="secondary" onClick={() => {
              openSetupView();
              setStatus('Вернулись к выбору папки.');
            }} disabled={actionsLocked}>Назад</Button>
            <Button type="button" variant="secondary" onClick={onReadAloud} disabled={actionsLocked || !resultText}>Прочитать</Button>
            <Button type="button" onClick={onCopy} disabled={actionsLocked || !resultText}>Скопировать</Button>
            <Button type="button" variant="secondary" onClick={onSave} disabled={actionsLocked || !resultText}>Сохранить</Button>
          </div>
        </div>
      )}

      <p className={styles.status}>{status}</p>
    </div>
  );
}
