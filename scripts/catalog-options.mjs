export function parseCatalogArgs(args) {
  const adapterNames = [];
  let probe = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--probe") {
      probe = true;
      continue;
    }
    if (arg === "--adapter") {
      const value = args[++i];
      if (!value) throw new Error("--adapter requires a value");
      pushAdapterNames(adapterNames, value);
      continue;
    }
    if (arg.startsWith("--adapter=")) {
      pushAdapterNames(adapterNames, arg.slice("--adapter=".length));
      continue;
    }
    throw new Error(`unknown option: ${arg}`);
  }

  return { probe, adapterNames };
}

function pushAdapterNames(out, value) {
  const names = value
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean);
  if (names.length === 0) throw new Error("--adapter requires a value");
  out.push(...names);
}
