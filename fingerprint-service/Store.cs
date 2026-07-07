using System;
using System.Collections.Generic;
using System.IO;
using System.Text.Json;

namespace CueMiiFingerprintService
{
    /// <summary>
    /// Persists enrolled fingerprint templates (enrollment FMDs) to a local
    /// JSON file. Key = playerId (string), Value = base64 enrollment FMD.
    /// This is the source of truth the matcher searches for 1:N identify.
    /// </summary>
    public class Store
    {
        private readonly string _path;
        private readonly object _lock = new object();
        private Dictionary<string, string> _map = new Dictionary<string, string>();

        public Store(string path)
        {
            _path = path;
            Load();
        }

        private void Load()
        {
            try
            {
                if (File.Exists(_path))
                {
                    var json = File.ReadAllText(_path);
                    _map = JsonSerializer.Deserialize<Dictionary<string, string>>(json)
                           ?? new Dictionary<string, string>();
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine("[Store] Failed to load: " + ex.Message);
                _map = new Dictionary<string, string>();
            }
        }

        private void Save()
        {
            var json = JsonSerializer.Serialize(_map, new JsonSerializerOptions { WriteIndented = true });
            File.WriteAllText(_path, json);
        }

        public int Count { get { lock (_lock) { return _map.Count; } } }

        /// <summary>Store (or replace) a player's enrollment template.</summary>
        public void Put(string playerId, string templateBase64)
        {
            lock (_lock)
            {
                _map[playerId] = templateBase64;
                Save();
            }
        }

        /// <summary>Bulk import templates (e.g. seeded from Firebase).</summary>
        public void Import(Dictionary<string, string> templates)
        {
            lock (_lock)
            {
                foreach (var kv in templates)
                    _map[kv.Key] = kv.Value;
                Save();
            }
        }

        /// <summary>Replace the entire store with the given templates (delete/reset).</summary>
        public void Replace(Dictionary<string, string> templates)
        {
            lock (_lock)
            {
                _map = new Dictionary<string, string>(templates);
                Save();
            }
        }

        /// <summary>Snapshot of all (playerId, templateBase64) pairs.</summary>
        public List<KeyValuePair<string, string>> All()
        {
            lock (_lock)
            {
                return new List<KeyValuePair<string, string>>(_map);
            }
        }
    }
}
