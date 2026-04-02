const fs = require('fs');
const https = require('https');
const yaml = require('js-yaml');

async function fetchTechnologyId(name) {
  return new Promise((resolve, reject) => {
    https.get(`https://api.icepanel.io/v1/catalog/technologies?filter[name]=${encodeURIComponent(name)}`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.data && json.data.length > 0) {
            // Find an exact match preferably, otherwise first match
            const exact = json.data.find(t => t.name.toLowerCase() === name.toLowerCase());
            resolve(exact ? exact.id : json.data[0].id);
          } else {
            console.warn(`[WARN] Technology not found for: ${name}. Re-trying generic...`);
            resolve(null);
          }
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

async function convert() {
  const content = fs.readFileSync('C4-Diagram.yaml', 'utf8');
  const source = yaml.load(content);

  const out = {
    modelObjects: [],
    modelConnections: []
  };

  const techCache = {};
  
  // Custom IcePanel tech ID mappings from user schema definition
  const getTech = async (searchStr) => {
    if (techCache[searchStr]) return techCache[searchStr];
    const techId = await fetchTechnologyId(searchStr);
    techCache[searchStr] = techId;
    return techId;
  };

  for (const obj of source.objects) {
    const iceObj = {
      id: obj.id,
      name: obj.name,
      type: obj.type,
      description: obj.description
    };
    if (obj.parentId) iceObj.parentId = obj.parentId;

    if (obj.icon && obj.icon.technologyId) {
      let searchStr = obj.icon.technologyId;
      if (searchStr.toLowerCase() === 'nodejs') searchStr = 'NodeJS';
      if (searchStr.toLowerCase() === 'typescript') searchStr = 'TypeScript';
      if (searchStr.toLowerCase() === 'python') searchStr = 'Python';
      if (searchStr.toLowerCase() === 'neo4j') searchStr = 'Neo4j';
      if (searchStr.toLowerCase() === 'postgresql') searchStr = 'PostgreSQL';
      if (searchStr.toLowerCase() === 'react') searchStr = 'React';

      const techId = await getTech(searchStr);
      if (techId) {
        iceObj.technologyIds = [techId];
        iceObj.icon = { technologyId: techId };
      }
    }
    out.modelObjects.push(iceObj);
  }

  for (let i = 0; i < source.connections.length; i++) {
    const conn = source.connections[i];
    const iceConn = {
      id: `conn-${i}`,
      name: conn.protocol || 'Connects',
      originId: conn.sourceId,
      targetId: conn.targetId,
      direction: conn.direction === 'two-way' ? 'two-way' : 'outgoing',
      description: conn.description || ''
    };
    out.modelConnections.push(iceConn);
  }

  const finalYamlStr = "# yaml-language-server: $schema=https://api.icepanel.io/v1/schemas/LandscapeImportData\n" + yaml.dump(out);
  fs.writeFileSync('icepanel-landscape-import.yaml', finalYamlStr, 'utf8');
  console.log("SUCCESS");
}

convert().catch(console.error);
