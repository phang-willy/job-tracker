import { jobBoardMatches } from '@/src/infrastructure/platforms/supported-hosts';

export default defineContentScript({
  matches: [...jobBoardMatches],
  main() {
    return;
  },
});
