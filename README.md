# Appointment Availability Helper

A Chrome extension prototype that watches an appointment page and selects the earliest available date and time at a chosen service center. Built for the Ukrainian MVS E-Zapys interface as a personal browser automation project.

## What it demonstrates

- A small Manifest V3 content script with a user controlled panel.
- DOM observation and response to newly available appointments without repeatedly reloading the page.
- A fallback refresh when the page's own availability polling stops.
- Chronological selection of the first available date and time, including morning slots.
- A dry-run mode that stops before any booking request.
- A single active run per browser profile, stop controls, timeout handling, and checks for changed page state.

The extension does **not** solve CAPTCHA. The user must sign in, choose the service, and complete CAPTCHA. The real booking path has not been verified end to end on a live appointment; tests use a mocked page. The interface and polling behavior may change.

## Run locally

1. Open `chrome://extensions` in Chrome and enable Developer mode.
2. Choose **Load unpacked** and select the [`extension`](extension) directory.
3. Sign in to E-Zapys, choose the practical exam and vehicle category, and open the service center map.
4. Use **Перевірка без бронювання** for a dry run. The default center is №2641 in Ivano-Frankivsk.

The [Ukrainian setup guide](SETUP.uk.md) has the full workflow. Do not run the extension and another automation in the same session.

## Tests

```sh
npm install
npm test
```

The browser test uses the locally installed Google Chrome and exercises 20 mocked scenarios. The fallback timeout is shortened in the test copy of the script so it can be tested quickly; production uses 90 seconds. No test creates a real appointment.

## Design notes

Inspection of the public page bundle on 2026-10-31 showed that the page requested service centers and dates about every 30 seconds and time slots about every 5 seconds. The extension watches the page's rendered state and uses those updates. It reopens the map once at 06:00 and only performs another refresh if no center request completes for 90 seconds. It stops on a rate-limit response rather than retrying automatically.

This repository contains no account credentials, CAPTCHA tokens, or contact details.
