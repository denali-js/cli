export default function globify(dirs: string[]) {
  return dirs.map((dir) => `${ dir }/**/*`);
}