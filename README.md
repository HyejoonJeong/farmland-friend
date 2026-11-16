# Gentle Guide

Build a mobile-first AI public service assistant for elderly farmers in South Korea.

The service must be voice-first and optimized for users over 60 years old with low digital literacy.

Primary goal:

Allow elderly farmers to simply speak about their situation. The AI understands the user's location, analyzes the administrative intent, and connects them to the correct government organization and department.

Supported organizations:

1. Korea Rural Community Corporation (Farmland Bank)

2. Jeonbuk Agricultural Research & Extension Services

3. National Agricultural Products Quality Management Service (NAQS)

User Flow:

Home

→ Ask for user's region first

→ Voice input (STT)

→ AI extracts user situation

→ Ask follow-up questions only if confidence is low

→ Intent classification

→ User confirmation

→ Match organization and department

→ Display required documents

→ Read response with TTS

→ Phone call button

Design Requirements:

- Mobile-first responsive design

- Very large buttons (minimum 56px height)

- Font size 20–28px

- High contrast colors

- One primary action per screen

- No typing required

- No login

- No chat UI

- Voice-first interaction

- Real-time speech transcription

- Animated microphone while listening

- TTS support for every screen

- Human support button always visible

AI Features:

- Speech-to-Text

- Text-to-Speech

- Intent Classification

- Situation Extraction

- Region Detection

- Department Matching

- Confidence Score with clarification questions

- Agricultural terminology dictionary

- Dialect-aware intent recognition

Output:

Create 8 polished mobile screens with accessible UI, smooth transitions, and production-ready components. Focus on an intuitive experience for elderly farmers and ensure the MVP can be demonstrated end-to-end in a hackathon.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://farmland-friend.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/295ae513-f336-46d2-b05c-32cecd1dafe1).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
