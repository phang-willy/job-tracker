import { afterEach, describe, expect, it, vi } from 'vitest';
import { watchJobDetails } from '@/src/infrastructure/platforms/linkedin/watch-job-details';

afterEach(() => {
  vi.useRealTimers();
  document.body.innerHTML = '';
});

describe('watchJobDetails', () => {
  it('ignores the feed and debounces changes inside the active offer', async () => {
    vi.useFakeTimers();
    document.body.innerHTML = `
      <div id="feed">Fil</div>
      <section>
        <div id="JobDetails_ManageJobBanner_1"></div>
        <h1>Web Developer</h1>
      </section>
    `;
    const onChange = vi.fn();
    const stop = watchJobDetails(document, onChange, 200);
    const feed = document.getElementById('feed');
    const title = document.querySelector('h1');

    expect(feed).not.toBeNull();
    expect(title).not.toBeNull();
    if (feed === null || title === null) {
      stop();
      return;
    }

    feed.textContent = 'Autre fil';
    await vi.advanceTimersByTimeAsync(250);
    expect(onChange).not.toHaveBeenCalled();

    title.textContent = 'Data Analyst';
    title.textContent = 'Platform Engineer';
    await vi.advanceTimersByTimeAsync(199);
    expect(onChange).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(onChange).toHaveBeenCalledTimes(1);

    stop();
    title.textContent = 'Ignored';
    await vi.advanceTimersByTimeAsync(250);
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('notifies once when another offer replaces the current one', async () => {
    vi.useFakeTimers();
    document.body.innerHTML = `
      <section id="details">
        <div id="JobDetails_ManageJobBanner_1"></div>
        <h1>Web Developer</h1>
      </section>
    `;
    const onChange = vi.fn();
    const stop = watchJobDetails(document, onChange, 200);
    const details = document.getElementById('details');

    expect(details).not.toBeNull();
    if (details === null) {
      stop();
      return;
    }

    details.innerHTML = `
      <div id="JobDetails_ManageJobBanner_2"></div>
      <h1>Data Analyst</h1>
    `;
    await vi.advanceTimersByTimeAsync(200);

    expect(onChange).toHaveBeenCalledTimes(1);
    stop();
  });

  it('notifies when the search results detail screen changes', async () => {
    vi.useFakeTimers();
    document.body.innerHTML = `
      <ul id="results"><li>OtherCo</li></ul>
      <div data-sdui-screen="com.linkedin.sdui.flagshipnav.jobs.SemanticJobDetails">
        <h1>Web Developer</h1>
      </div>
    `;
    const onChange = vi.fn();
    const stop = watchJobDetails(document, onChange, 200);
    const results = document.getElementById('results');
    const title = document.querySelector('h1');

    expect(results).not.toBeNull();
    expect(title).not.toBeNull();
    if (results === null || title === null) {
      stop();
      return;
    }

    results.textContent = 'Autre liste';
    await vi.advanceTimersByTimeAsync(250);
    expect(onChange).not.toHaveBeenCalled();

    title.textContent = 'Data Analyst';
    await vi.advanceTimersByTimeAsync(200);
    expect(onChange).toHaveBeenCalledTimes(1);
    stop();
  });
});
