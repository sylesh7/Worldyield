'use client';
import { Button, LiveFeedback } from '@worldcoin/mini-apps-ui-kit-react';
import { MiniKit, Permission } from '@worldcoin/minikit-js';
import { useCallback, useEffect, useState } from 'react';

/**
 * This component demonstrates permission management for notifications and microphone
 * Required for: Rebalance alerts and future voice features
 * Read More: https://docs.world.org/mini-apps/commands/request-permission
 */
export const Permissions = () => {
  const [buttonState, setButtonState] = useState<
    'pending' | 'success' | 'failed' | undefined
  >(undefined);
  const [permissions, setPermissions] = useState<{
    notifications: boolean;
    microphone: boolean;
  }>({
    notifications: false,
    microphone: false,
  });

  // Fetch current permissions on mount
  useEffect(() => {
    const fetchPermissions = async () => {
      if (!MiniKit.isInstalled()) {
        return;
      }

      try {
        const result = await MiniKit.commandsAsync.getPermissions();
        if (result.finalPayload.status === 'success') {
          const perms = result.finalPayload.permissions;
          setPermissions({
            notifications: perms.notifications || false,
            microphone: perms.microphone || false,
          });
        }
      } catch (error) {
        console.error('Error fetching permissions:', error);
      }
    };

    fetchPermissions();
  }, []);

  const requestNotifications = useCallback(async () => {
    if (!MiniKit.isInstalled()) {
      return;
    }

    setButtonState('pending');
    try {
      const result = await MiniKit.commandsAsync.requestPermission({
        permission: Permission.Notifications,
      });

      if (result.finalPayload.status === 'success') {
        setButtonState('success');
        setPermissions((prev) => ({ ...prev, notifications: true }));
        setTimeout(() => setButtonState(undefined), 2000);
      } else {
        setButtonState('failed');
        console.error(
          'Permission request failed:',
          result.finalPayload.error_code
        );
        setTimeout(() => setButtonState(undefined), 3000);
      }
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      setButtonState('failed');
      setTimeout(() => setButtonState(undefined), 3000);
    }
  }, []);

  const requestMicrophone = useCallback(async () => {
    if (!MiniKit.isInstalled()) {
      return;
    }

    setButtonState('pending');
    try {
      const result = await MiniKit.commandsAsync.requestPermission({
        permission: Permission.Microphone,
      });

      if (result.finalPayload.status === 'success') {
        setButtonState('success');
        setPermissions((prev) => ({ ...prev, microphone: true }));
        setTimeout(() => setButtonState(undefined), 2000);
      } else {
        setButtonState('failed');
        console.error(
          'Permission request failed:',
          result.finalPayload.error_code
        );
        setTimeout(() => setButtonState(undefined), 3000);
      }
    } catch (error) {
      console.error('Error requesting microphone permission:', error);
      setButtonState('failed');
      setTimeout(() => setButtonState(undefined), 3000);
    }
  }, []);

  return (
    <div className="grid w-full gap-4">
      <p className="text-lg font-semibold">Permissions</p>
      <div className="text-sm text-gray-600">
        <p>
          Notifications:{' '}
          <span className={permissions.notifications ? 'text-green-600' : 'text-red-600'}>
            {permissions.notifications ? 'Granted' : 'Not granted'}
          </span>
        </p>
        <p>
          Microphone:{' '}
          <span className={permissions.microphone ? 'text-green-600' : 'text-red-600'}>
            {permissions.microphone ? 'Granted' : 'Not granted'}
          </span>
        </p>
      </div>
      <LiveFeedback
        label={{
          failed: 'Permission denied',
          pending: 'Requesting permission',
          success: 'Permission granted',
        }}
        state={buttonState}
        className="w-full"
      >
        <Button
          onClick={requestNotifications}
          disabled={buttonState === 'pending' || permissions.notifications}
          size="lg"
          variant="primary"
          className="w-full"
        >
          {permissions.notifications
            ? 'Notifications Enabled'
            : 'Enable Notifications'}
        </Button>
      </LiveFeedback>
      <LiveFeedback
        label={{
          failed: 'Permission denied',
          pending: 'Requesting permission',
          success: 'Permission granted',
        }}
        state={buttonState}
        className="w-full"
      >
        <Button
          onClick={requestMicrophone}
          disabled={buttonState === 'pending' || permissions.microphone}
          size="lg"
          variant="tertiary"
          className="w-full"
        >
          {permissions.microphone
            ? 'Microphone Enabled'
            : 'Enable Microphone'}
        </Button>
      </LiveFeedback>
    </div>
  );
};
